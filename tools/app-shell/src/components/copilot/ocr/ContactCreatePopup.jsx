import { useState, useEffect, useMemo, useRef } from 'react';
import { X, Loader2, Search, ChevronDown, Check, AlertCircle } from 'lucide-react';
import { useUI } from '@/i18n';
import { deriveContactsApiBase } from './contactApi';

/* eslint-disable react/prop-types */

const SELECTOR_PAGE_SIZE = 120;

function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

async function fetchSelectorPage(url, headers) {
  const response = await fetch(url, { headers });
  if (!response.ok) throw new Error(`Selector request failed: ${response.status}`);
  const data = await response.json();
  const items = data?.items ?? data?.response?.data ?? [];
  return {
    items: Array.isArray(items) ? items : [],
    hasMore: Boolean(data?.hasMore),
  };
}

const EMPTY_FORM = {
  type: 'C', // 'C' = Company, 'P' = Person
  name: '',
  etgoIdentifier: '',
  taxId: '',
  firstName: '',
  lastName: '',
  // location
  addressLine1: '',
  addressLine2: '',
  postalCode: '',
  city: '',
  country: '',
  countryLabel: '',
  region: '',
  regionLabel: '',
  shipToAddress: true,
  invoiceToAddress: true,
};

/**
 * Renderer for `needsDecision.kind === "createContact"`.
 *
 * Displays the OCR-extracted contact data as an editable form (legal name,
 * tax id, location). On confirm, packages the values as
 * `{ action: 'create', fields: { ...bpFields, location: { ... } } }` and
 * hands them to {@code onSubmit} — the parent then resubmits the ingest call
 * with this decision merged in. The actual BP + location create runs
 * server-side inside the ingest transaction, so this component owns the
 * collection of input only, never the persistence.
 *
 * Props match the generic decision-renderer contract so this component is
 * also reachable via the renderer registry from any other ingest spec that
 * surfaces a {@code createContact} decision.
 */
export default function ContactCreatePopup({
  item,
  apiBaseUrl,
  token,
  onSubmit,
  onCancel,
}) {
  const ui = useUI();
  const contactsApiBase = useMemo(() => deriveContactsApiBase(apiBaseUrl), [apiBaseUrl]);
  const authHeader = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const prefill = useMemo(() => item?.payload?.prefilled || {}, [item]);

  const [form, setForm] = useState(() => ({
    ...EMPTY_FORM,
    name: prefill.name || prefill.legalName || '',
    taxId: prefill.taxId || '',
    addressLine1: prefill.addressLine1 || '',
    addressLine2: prefill.addressLine2 || '',
    city: prefill.city || '',
    postalCode: prefill.postalCode || '',
  }));

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const [countries, setCountries] = useState([]);
  const [countrySelectorBase, setCountrySelectorBase] = useState('');
  const [countryOffset, setCountryOffset] = useState(0);
  const [countryHasMore, setCountryHasMore] = useState(false);
  const [countryLoadingMore, setCountryLoadingMore] = useState(false);
  const [countriesLoading, setCountriesLoading] = useState(false);
  const [countriesLoadFailed, setCountriesLoadFailed] = useState(false);

  const [regions, setRegions] = useState([]);
  const [regionSelectorBase, setRegionSelectorBase] = useState('');
  const [regionOffset, setRegionOffset] = useState(0);
  const [regionHasMore, setRegionHasMore] = useState(false);
  const [regionLoadingMore, setRegionLoadingMore] = useState(false);
  const [regionsLoading, setRegionsLoading] = useState(false);
  const [regionsLoadFailed, setRegionsLoadFailed] = useState(false);

  const [countryPickerOpen, setCountryPickerOpen] = useState(false);
  const [countryQuery, setCountryQuery] = useState('');
  const [regionPickerOpen, setRegionPickerOpen] = useState(false);
  const [regionQuery, setRegionQuery] = useState('');
  const countrySearchRef = useRef(null);
  const regionSearchRef = useRef(null);
  const countryLoadMoreRef = useRef(null);
  const regionLoadMoreRef = useRef(null);
  const countryLoadingMoreRef = useRef(false);
  const regionLoadingMoreRef = useRef(false);

  const setField = (key, value) => {
    setForm(prev => {
      const next = { ...prev, [key]: value };
      if (key === 'country') {
        next.region = '';
        next.regionLabel = '';
      }
      return next;
    });
  };

  // Fetch sequence-assigned identifier/searchKey and the configured default
  // country (context.countrydef) the same way the Contact window does on a new
  // record. Mirrors useEntity.handleNew's call to /{entity}/defaults.
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [bpRes, locRes] = await Promise.all([
          fetch(`${contactsApiBase}/businessPartner/defaults`, { headers: authHeader }).catch(() => null),
          fetch(`${contactsApiBase}/locationAddress/defaults`, { headers: authHeader }).catch(() => null),
        ]);
        if (cancelled) return;
        const bp = bpRes && bpRes.ok ? (await bpRes.json())?.defaults || {} : {};
        const loc = locRes && locRes.ok ? (await locRes.json())?.defaults || {} : {};
        setForm(prev => ({
          ...prev,
          etgoIdentifier: prev.etgoIdentifier || bp.etgoIdentifier || '',
          country: prev.country || loc.country || '',
          countryLabel: prev.countryLabel || loc.country$_identifier || '',
        }));
      } catch {
        // Best-effort — popup remains usable with empty defaults.
      }
    };
    load();
    return () => { cancelled = true; };
  }, [contactsApiBase, authHeader]);

  // Load countries on mount
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setCountriesLoading(true);
      const candidates = [
        `${contactsApiBase}/locationAddress/selectors/C_Country_ID`,
        `${contactsApiBase}/intrastatAdquisitions/selectors/country`,
        `${contactsApiBase}/locationAddress/selectors/country`,
        `${contactsApiBase}/intrastatAdquisitions/selectors/C_Country_ID`,
      ];
      let succeeded = false;
      for (const baseUrl of candidates) {
        try {
          const params = new URLSearchParams({ limit: String(SELECTOR_PAGE_SIZE), offset: '0' });
          const { items, hasMore } = await fetchSelectorPage(`${baseUrl}?${params}`, authHeader);
          succeeded = true;
          if (items.length > 0 || hasMore) {
            if (cancelled) return;
            setCountries(items);
            setCountrySelectorBase(baseUrl);
            setCountryOffset(items.length);
            setCountryHasMore(hasMore && items.length > 0);
            break;
          }
        } catch {
          // try next candidate
        }
      }
      if (!cancelled) {
        setCountriesLoadFailed(!succeeded);
        setCountriesLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [contactsApiBase, authHeader]);

  // Reload regions when country changes
  useEffect(() => {
    let cancelled = false;
    if (!form.country) {
      setRegions([]);
      setRegionSelectorBase('');
      setRegionOffset(0);
      setRegionHasMore(false);
      setRegionsLoadFailed(false);
      return;
    }
    const load = async () => {
      setRegionsLoading(true);
      setRegionsLoadFailed(false);
      const candidates = [
        `${contactsApiBase}/locationAddress/selectors/C_Region_ID`,
        `${contactsApiBase}/intrastatAdquisitions/selectors/C_Region_ID`,
        `${contactsApiBase}/locationAddress/selectors/region`,
      ];
      let resolvedBase = '';
      let resolvedItems = [];
      let resolvedHasMore = false;
      for (const baseUrl of candidates) {
        try {
          const params = new URLSearchParams({
            C_Country_ID: form.country,
            country: form.country,
            limit: String(SELECTOR_PAGE_SIZE),
            offset: '0',
          });
          const { items, hasMore } = await fetchSelectorPage(`${baseUrl}?${params}`, authHeader);
          if (items.length > 0 || hasMore) {
            resolvedBase = baseUrl;
            resolvedItems = items;
            resolvedHasMore = hasMore;
            break;
          }
        } catch {
          // try next
        }
      }
      if (cancelled) return;
      if (!resolvedBase) {
        setRegions([]);
        setRegionsLoadFailed(true);
      } else {
        setRegionSelectorBase(resolvedBase);
        setRegions(resolvedItems);
        setRegionOffset(resolvedItems.length);
        setRegionHasMore(resolvedHasMore && resolvedItems.length > 0);
      }
      setRegionsLoading(false);
    };
    load();
    return () => { cancelled = true; };
  }, [form.country, contactsApiBase, authHeader]);

  // Picker focus & infinite scroll wiring (parallels LocationEditorModal)
  useEffect(() => {
    if (!countryPickerOpen) { setCountryQuery(''); return; }
    const t = setTimeout(() => countrySearchRef.current?.focus(), 40);
    return () => clearTimeout(t);
  }, [countryPickerOpen]);

  useEffect(() => {
    if (!regionPickerOpen) { setRegionQuery(''); return; }
    const t = setTimeout(() => regionSearchRef.current?.focus(), 40);
    return () => clearTimeout(t);
  }, [regionPickerOpen]);

  useEffect(() => {
    if (!countryPickerOpen) return undefined;
    const sentinel = countryLoadMoreRef.current;
    if (!sentinel) return undefined;
    const observer = new IntersectionObserver(entries => {
      if (!entries[0]?.isIntersecting) return;
      if (!countrySelectorBase || !countryHasMore || countriesLoading || countryLoadingMoreRef.current) return;
      countryLoadingMoreRef.current = true;
      setCountryLoadingMore(true);
      const params = new URLSearchParams({ limit: String(SELECTOR_PAGE_SIZE), offset: String(countryOffset) });
      fetchSelectorPage(`${countrySelectorBase}?${params}`, authHeader)
        .then(({ items, hasMore }) => {
          setCountries(prev => [...prev, ...items]);
          setCountryOffset(prev => prev + items.length);
          setCountryHasMore(hasMore && items.length > 0);
        })
        .catch(() => setCountryHasMore(false))
        .finally(() => {
          countryLoadingMoreRef.current = false;
          setCountryLoadingMore(false);
        });
    }, { threshold: 0.1 });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [countryPickerOpen, countrySelectorBase, countryHasMore, countryOffset, countriesLoading, authHeader]);

  useEffect(() => {
    if (!regionPickerOpen) return undefined;
    const sentinel = regionLoadMoreRef.current;
    if (!sentinel) return undefined;
    const observer = new IntersectionObserver(entries => {
      if (!entries[0]?.isIntersecting) return;
      if (!regionSelectorBase || !form.country || !regionHasMore || regionsLoading || regionLoadingMoreRef.current) return;
      regionLoadingMoreRef.current = true;
      setRegionLoadingMore(true);
      const params = new URLSearchParams({
        C_Country_ID: form.country,
        country: form.country,
        limit: String(SELECTOR_PAGE_SIZE),
        offset: String(regionOffset),
      });
      fetchSelectorPage(`${regionSelectorBase}?${params}`, authHeader)
        .then(({ items, hasMore }) => {
          setRegions(prev => [...prev, ...items]);
          setRegionOffset(prev => prev + items.length);
          setRegionHasMore(hasMore && items.length > 0);
        })
        .catch(() => setRegionHasMore(false))
        .finally(() => {
          regionLoadingMoreRef.current = false;
          setRegionLoadingMore(false);
        });
    }, { threshold: 0.1 });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [regionPickerOpen, regionSelectorBase, regionHasMore, regionOffset, regionsLoading, form.country, authHeader]);

  const countryOptions = useMemo(() => (countries ?? []).map(item => ({
    id: item.id,
    label: item.label || item.name || item._identifier || item.id,
  })).filter(c => c.id), [countries]);

  const filteredCountries = useMemo(() => {
    const q = normalizeText(countryQuery.trim());
    if (!q) return countryOptions;
    return countryOptions.filter(c => normalizeText(c.label).includes(q));
  }, [countryOptions, countryQuery]);

  const selectedCountryLabel = useMemo(() => {
    if (!form.country) return ui('ocrCountrySelect') || 'Select…';
    return countryOptions.find(c => c.id === form.country)?.label || form.countryLabel || form.country;
  }, [countryOptions, form.country, form.countryLabel, ui]);

  const regionOptions = useMemo(() => (regions ?? []).map(item => ({
    id: item.id,
    label: item.label || item.name || item._identifier || item.id,
  })).filter(r => r.id), [regions]);

  const filteredRegions = useMemo(() => {
    const q = normalizeText(regionQuery.trim());
    if (!q) return regionOptions;
    return regionOptions.filter(r => normalizeText(r.label).includes(q));
  }, [regionOptions, regionQuery]);

  const selectedRegionLabel = useMemo(() => {
    if (!form.region) return ui('ocrRegionSelect') || 'Select…';
    return regionOptions.find(r => r.id === form.region)?.label || form.regionLabel || form.region;
  }, [regionOptions, form.region, form.regionLabel, ui]);

  const handleCountrySelect = (countryId) => {
    const found = countryOptions.find(c => c.id === countryId);
    setForm(prev => ({
      ...prev,
      country: countryId,
      countryLabel: found?.label ?? '',
      region: '',
      regionLabel: '',
    }));
    setCountryPickerOpen(false);
  };

  const handleRegionSelect = (regionId) => {
    const found = regionOptions.find(r => r.id === regionId);
    setForm(prev => ({
      ...prev,
      region: regionId,
      regionLabel: found?.label ?? '',
    }));
    setRegionPickerOpen(false);
  };

  const validate = () => {
    if (!form.name.trim()) return ui('ocrContactNameRequired');
    if (form.type === 'P' && !form.firstName.trim()) return ui('ocrContactFirstNameRequired');
    if (!form.country) return ui('ocrContactCountryRequired');
    return null;
  };

  const submit = () => {
    setError(null);
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setSubmitting(true);

    // Build the BP payload exactly as the prior client-side createContact() did,
    // so the server-side ContactResolver can pass it through unchanged to the
    // contacts/businessPartner spec. The location goes nested so the resolver
    // can detect it and chain a contacts/locationAddress create with the new
    // BP id as parent — all inside the ingest transaction.
    // BatchService bypasses NeoHandler hooks, so BusinessPartnerHandler's
    // auto-inject of `searchKey` and post-save rewrite from em_etgo_identifier
    // never run when we come in through /batch. We replicate the hook's effect
    // here: send `searchKey` set to the resolved sequence value (or fall back
    // to `name` if the defaults endpoint didn't supply an identifier).
    const identifierRaw = form.etgoIdentifier.trim();
    const identifierClean = identifierRaw.replace(/^<|>$/g, '');
    const bpFields = {
      name: form.name.trim(),
      searchKey: identifierClean || form.name.trim(),
      etgoIdentifier: identifierRaw || null,
      taxID: form.taxId.trim() || null,
      isVendor: true,
      // The SF field default for this list reference is literally "'1'" (with
      // surrounding quotes), which the runtime validator rejects. Send the
      // bare value so it bypasses that broken default.
      oBTIKTaxIDKey: '1',
    };
    if (form.type === 'P') {
      bpFields.em_etgo_firstname = form.firstName.trim();
      bpFields.em_etgo_lastname = form.lastName.trim() || null;
    }

    const locName = [form.city, form.addressLine1].filter(Boolean).join(', ')
      || [form.regionLabel || form.region, form.countryLabel || form.country].filter(Boolean).join(', ')
      || 'Location';
    const location = {
      name: locName,
      addressLine1: form.addressLine1.trim() || null,
      addressLine2: form.addressLine2.trim() || null,
      cityName: form.city.trim() || null,
      postalCode: form.postalCode.trim() || null,
      country: form.country || null,
      region: form.region || null,
      shipToAddress: form.shipToAddress ? 'Y' : 'N',
      invoiceToAddress: form.invoiceToAddress ? 'Y' : 'N',
    };

    try {
      onSubmit({
        action: 'create',
        fields: { ...bpFields, location },
      });
    } catch (e) {
      setError(e?.message || ui('ocrContactCreateFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  const cancel = () => onCancel?.();

  return (
    <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-900">{ui('ocrContactCreateTitle')}</h2>
          <button onClick={cancel} aria-label={ui('cancel')} className="text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* Type toggle */}
          <div className="flex gap-2">
            {[
              { v: 'C', l: ui('ocrContactCompany') },
              { v: 'P', l: ui('ocrContactPerson') },
            ].map(opt => (
              <button
                key={opt.v}
                type="button"
                onClick={() => setField('type', opt.v)}
                className={[
                  'flex-1 px-3 py-2 text-sm rounded-lg border transition-colors',
                  form.type === opt.v
                    ? 'border-blue-600 bg-blue-50 text-blue-700 font-medium'
                    : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50',
                ].join(' ')}
              >
                {opt.l}
              </button>
            ))}
          </div>

          {/* Contact section */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              {ui('ocrContactSectionContact')}
            </h3>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                {form.type === 'C' ? ui('ocrContactLegalName') : ui('ocrContactName')}
              </label>
              <input
                type="text"
                value={form.name}
                onChange={e => setField('name', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {form.type === 'P' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">{ui('ocrContactFirstName')}</label>
                  <input
                    type="text"
                    value={form.firstName}
                    onChange={e => setField('firstName', e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">{ui('ocrContactLastName')}</label>
                  <input
                    type="text"
                    value={form.lastName}
                    onChange={e => setField('lastName', e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">{ui('ocrContactIdentifier')}</label>
                <input
                  type="text"
                  value={form.etgoIdentifier.replace(/^<|>$/g, '')}
                  readOnly
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-600 cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">{ui('ocrContactTaxId')}</label>
                <input
                  type="text"
                  value={form.taxId}
                  onChange={e => setField('taxId', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </section>

          {/* Location section */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              {ui('ocrContactSectionLocation')}
            </h3>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">{ui('addressLine1')}</label>
              <input
                type="text"
                value={form.addressLine1}
                onChange={e => setField('addressLine1', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">{ui('addressLine2')}</label>
              <input
                type="text"
                value={form.addressLine2}
                onChange={e => setField('addressLine2', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">{ui('postalCodeLabel')}</label>
                <input
                  type="text"
                  value={form.postalCode}
                  onChange={e => setField('postalCode', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">{ui('cityLabel')}</label>
                <input
                  type="text"
                  value={form.city}
                  onChange={e => setField('city', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">{ui('countryLabel')}</label>
              <button
                type="button"
                onClick={() => setCountryPickerOpen(true)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors flex items-center justify-between gap-2"
              >
                <span className={`truncate ${form.country ? 'text-gray-900' : 'text-gray-500'}`}>
                  {selectedCountryLabel}
                </span>
                <ChevronDown size={16} className="text-gray-500 shrink-0" />
              </button>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">{ui('regionLabel')}</label>
              <button
                type="button"
                onClick={() => { if (form.country) setRegionPickerOpen(true); }}
                disabled={!form.country}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors flex items-center justify-between gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className={`truncate ${form.region ? 'text-gray-900' : 'text-gray-500'}`}>
                  {!form.country ? ui('selectCountryFirst') : selectedRegionLabel}
                </span>
                <ChevronDown size={16} className="text-gray-500 shrink-0" />
              </button>
            </div>
          </section>

          {error && (
            <div className="flex items-start gap-2 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              <div>{error}</div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200">
          <button
            onClick={cancel}
            disabled={submitting}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
          >
            {ui('cancel')}
          </button>
          <button
            onClick={submit}
            disabled={submitting}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {submitting && <Loader2 size={13} className="animate-spin" />}
            {ui('ocrContactCreate')}
          </button>
        </div>
      </div>

      {countryPickerOpen && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center bg-black/30 p-4"
          onMouseDown={() => setCountryPickerOpen(false)}
        >
          <div
            className="w-full max-w-md max-h-[540px] bg-white rounded-xl shadow-2xl flex flex-col"
            onMouseDown={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <h3 className="text-sm font-semibold text-gray-900">{ui('countryLabel')}</h3>
              <button onClick={() => setCountryPickerOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={16} />
              </button>
            </div>
            <div className="px-4 py-3 border-b border-gray-100">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  ref={countrySearchRef}
                  type="text"
                  value={countryQuery}
                  onChange={e => setCountryQuery(e.target.value)}
                  placeholder={ui('countrySearchPlaceholder')}
                  className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="flex-1 overflow-auto py-1">
              {countriesLoading ? (
                <div className="px-4 py-6 text-center text-sm text-gray-500">{ui('loading')}</div>
              ) : countriesLoadFailed ? (
                <div className="px-4 py-6 text-center text-sm text-gray-500">{ui('countryLoadError')}</div>
              ) : filteredCountries.length === 0 ? (
                <div className="px-4 py-6 text-center text-sm text-gray-500">{ui('noResults')}</div>
              ) : (
                filteredCountries.map(c => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => handleCountrySelect(c.id)}
                    className={[
                      'w-full flex items-center gap-2 px-4 py-2.5 text-sm text-left hover:bg-gray-50',
                      form.country === c.id ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-800',
                    ].join(' ')}
                  >
                    <span className="w-4 shrink-0">{form.country === c.id ? <Check size={14} /> : null}</span>
                    <span className="truncate">{c.label}</span>
                  </button>
                ))
              )}
              {!countriesLoading && !countriesLoadFailed && (
                <div ref={countryLoadMoreRef} className="flex justify-center py-2">
                  {countryLoadingMore ? <Loader2 size={14} className="animate-spin text-gray-400" /> : <span className="h-3" />}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {regionPickerOpen && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center bg-black/30 p-4"
          onMouseDown={() => setRegionPickerOpen(false)}
        >
          <div
            className="w-full max-w-md max-h-[540px] bg-white rounded-xl shadow-2xl flex flex-col"
            onMouseDown={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <h3 className="text-sm font-semibold text-gray-900">{ui('regionLabel')}</h3>
              <button onClick={() => setRegionPickerOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={16} />
              </button>
            </div>
            <div className="px-4 py-3 border-b border-gray-100">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  ref={regionSearchRef}
                  type="text"
                  value={regionQuery}
                  onChange={e => setRegionQuery(e.target.value)}
                  placeholder={ui('regionSearchPlaceholder')}
                  className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="flex-1 overflow-auto py-1">
              {regionsLoading ? (
                <div className="px-4 py-6 text-center text-sm text-gray-500">{ui('loading')}</div>
              ) : regionsLoadFailed ? (
                <div className="px-4 py-6 text-center text-sm text-gray-500">{ui('regionLoadError')}</div>
              ) : filteredRegions.length === 0 ? (
                <div className="px-4 py-6 text-center text-sm text-gray-500">{ui('noResults')}</div>
              ) : (
                filteredRegions.map(r => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => handleRegionSelect(r.id)}
                    className={[
                      'w-full flex items-center gap-2 px-4 py-2.5 text-sm text-left hover:bg-gray-50',
                      form.region === r.id ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-800',
                    ].join(' ')}
                  >
                    <span className="w-4 shrink-0">{form.region === r.id ? <Check size={14} /> : null}</span>
                    <span className="truncate">{r.label}</span>
                  </button>
                ))
              )}
              {!regionsLoading && !regionsLoadFailed && (
                <div ref={regionLoadMoreRef} className="flex justify-center py-2">
                  {regionLoadingMore ? <Loader2 size={14} className="animate-spin text-gray-400" /> : <span className="h-3" />}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

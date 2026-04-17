import { useState, useEffect, useMemo, useRef } from 'react';
import { X, Loader2, Search, ChevronDown, Check } from 'lucide-react';
import { useUI, useLabel } from '@/i18n';
import { toast } from 'sonner';

const EMPTY_FORM = { address: '', address2: '', postalCode: '', city: '', country: '', countryLabel: '', region: '', regionLabel: '', shipToAddress: true, invoiceToAddress: true };
const SELECTOR_PAGE_SIZE = 120;

function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

async function fetchSelectorPage(url, headers) {
  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(`Selector request failed: ${response.status}`);
  }
  const data = await response.json();
  const items = data?.items ?? data?.response?.data ?? [];
  return {
    items: Array.isArray(items) ? items : [],
    hasMore: Boolean(data?.hasMore),
  };
}

/**
 * LocationEditorModal — create or edit a C_BPartner_Location record with its
 * underlying C_Location fields (address lines, city, postal code, country, region).
 *
 * All CRUD operations go through the contacts/locationAddress endpoint so that
 * the user only needs AD_Window_Access to the Contacts window (ID 123), replicating
 * Classic Etendo's child-tab permission model.
 *
 * Props:
 *   open            — boolean: controls visibility
 *   onClose         — () => void
 *   onSaved         — () => void: called after successful save; caller re-fetches address state
 *   bplLinkId       — string|null: C_BPartner_Location_ID of existing record (null = create)
 *   bpId            — string: parent Business Partner ID (required for create)
 *   contactsApiBase — string: e.g. "/sws/neo/contacts"
 *   token           — string: JWT bearer token
 */
export default function LocationEditorModal({
  open,
  onClose,
  onSaved,
  bplLinkId,
  bpId,
  contactsApiBase,
  token,
  selectorContext = {},
}) {
  const ui = useUI();
  const t = useLabel();
  const [form, setForm] = useState(EMPTY_FORM);
  const [countries, setCountries] = useState([]);
  const [countrySelectorBase, setCountrySelectorBase] = useState('');
  const [countryOffset, setCountryOffset] = useState(0);
  const [countryHasMore, setCountryHasMore] = useState(false);
  const [countryLoadingMore, setCountryLoadingMore] = useState(false);
  const [regions, setRegions] = useState([]);
  const [regionSelectorBase, setRegionSelectorBase] = useState('');
  const [regionOffset, setRegionOffset] = useState(0);
  const [regionHasMore, setRegionHasMore] = useState(false);
  const [regionLoadingMore, setRegionLoadingMore] = useState(false);
  const [countriesLoading, setCountriesLoading] = useState(false);
  const [countriesLoadFailed, setCountriesLoadFailed] = useState(false);
  const [regionsLoading, setRegionsLoading] = useState(false);
  const [regionsLoadFailed, setRegionsLoadFailed] = useState(false);
  const [initialLoading, setInitialLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [countryPickerOpen, setCountryPickerOpen] = useState(false);
  const [countryQuery, setCountryQuery] = useState('');
  const [regionPickerOpen, setRegionPickerOpen] = useState(false);
  const [regionQuery, setRegionQuery] = useState('');
  const countrySearchRef = useRef(null);
  const countryLoadMoreRef = useRef(null);
  const countryLoadingMoreRef = useRef(false);
  const regionSearchRef = useRef(null);
  const regionLoadMoreRef = useRef(null);
  const regionLoadingMoreRef = useRef(false);

  const authHeader = { Authorization: `Bearer ${token}` };

  function buildSelectorParams(baseParams = {}) {
    const params = new URLSearchParams();
    Object.entries(selectorContext || {}).forEach(([key, value]) => {
      if (value == null || value === '') return;
      params.set(key, String(value));
    });
    Object.entries(baseParams).forEach(([key, value]) => {
      if (value == null || value === '') return;
      params.set(key, String(value));
    });
    return params;
  }

  const countryOptions = useMemo(() => {
    const seen = new Set();
    return (countries ?? []).reduce((acc, item) => {
      if (!item?.id || seen.has(item.id)) return acc;
      seen.add(item.id);
      acc.push({
        id: item.id,
        label: item.label || item.name || item._identifier || item.id,
      });
      return acc;
    }, []);
  }, [countries]);

  const filteredCountries = useMemo(() => {
    const q = normalizeText(countryQuery.trim());
    if (!q) return countryOptions;
    return countryOptions.filter((country) => normalizeText(country.label).includes(q));
  }, [countryOptions, countryQuery]);

  const selectedCountryLabel = useMemo(() => {
    if (!form.country) return '—';
    return countryOptions.find((country) => country.id === form.country)?.label || form.countryLabel || form.country;
  }, [countryOptions, form.country, form.countryLabel]);

  const regionOptions = useMemo(() => {
    const seen = new Set();
    return (regions ?? []).reduce((acc, item) => {
      if (!item?.id || seen.has(item.id)) return acc;
      seen.add(item.id);
      acc.push({
        id: item.id,
        label: item.label || item.name || item._identifier || item.id,
      });
      return acc;
    }, []);
  }, [regions]);

  const filteredRegions = useMemo(() => {
    const q = normalizeText(regionQuery.trim());
    if (!q) return regionOptions;
    return regionOptions.filter((region) => normalizeText(region.label).includes(q));
  }, [regionOptions, regionQuery]);

  const selectedRegionLabel = useMemo(() => {
    if (!form.region) return '—';
    return regionOptions.find((region) => region.id === form.region)?.label || form.regionLabel || form.region;
  }, [regionOptions, form.region, form.regionLabel]);

  // Reset and load data on open
  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    setForm(EMPTY_FORM);
    setRegions([]);
    setRegionSelectorBase('');
    setRegionOffset(0);
    setRegionHasMore(false);
    setRegionLoadingMore(false);
    regionLoadingMoreRef.current = false;
    setCountries([]);
    setCountrySelectorBase('');
    setCountryOffset(0);
    setCountryHasMore(false);
    setCountryLoadingMore(false);
    countryLoadingMoreRef.current = false;
    setCountriesLoading(false);
    setCountriesLoadFailed(false);
    setRegionsLoading(false);
    setRegionsLoadFailed(false);
    setInitialLoading(false);
    setSaving(false);
    setCountryPickerOpen(false);
    setCountryQuery('');
    setRegionPickerOpen(false);
    setRegionQuery('');

    // Load country catalog
    const loadCountries = async () => {
      setCountriesLoading(true);
      const selectorBases = [
        `${contactsApiBase}/locationAddress/selectors/C_Country_ID`,
        `${contactsApiBase}/intrastatAdquisitions/selectors/country`,
        `${contactsApiBase}/locationAddress/selectors/country`,
        `${contactsApiBase}/bankAccount/selectors/country`,
        `${contactsApiBase}/intrastatAdquisitions/selectors/C_Country_ID`,
        `${contactsApiBase}/bankAccount/selectors/C_Country_ID`,
      ];

      let hasSuccessfulRequest = false;

      for (const baseUrl of selectorBases) {
        try {
          const params = buildSelectorParams({
            limit: String(SELECTOR_PAGE_SIZE),
            offset: '0',
          });
          const { items, hasMore } = await fetchSelectorPage(`${baseUrl}?${params.toString()}`, authHeader);
          hasSuccessfulRequest = true;
          if (items.length > 0 || hasMore) {
            if (cancelled) return;
            setCountries(items);
            setCountrySelectorBase(baseUrl);
            setCountryOffset(items.length);
            setCountryHasMore(hasMore && items.length > 0);
            setCountriesLoadFailed(false);
            setCountriesLoading(false);
            break;
          }
        } catch (_error) {
          // Try next selector source.
        }
      }

      if (!cancelled && !hasSuccessfulRequest) {
        setCountries([]);
        setCountrySelectorBase('');
        setCountryOffset(0);
        setCountryHasMore(false);
        setCountriesLoadFailed(true);
        setCountriesLoading(false);
      }

      if (!cancelled && hasSuccessfulRequest) {
        setCountriesLoading(false);
      }
    };

    loadCountries();

    // Populate form when editing an existing record
    if (bplLinkId) {
      setInitialLoading(true);
      // ContactsLocationAddressHandler enriches the GET-by-ID response with C_Location fields.
      fetch(`${contactsApiBase}/locationAddress/${bplLinkId}`, { headers: authHeader })
        .then(r => (r.ok ? r.json() : null))
        .then(d => {
          const rec = d?.response?.data?.[0] ?? d;
          if (rec && rec.id) {
            setForm({
              address: rec.address ?? rec.addressLine1 ?? '',
              address2: rec.address2 ?? rec.addressLine2 ?? '',
              postalCode: rec.postalCode ?? '',
              city: rec.city ?? rec.cityName ?? '',
              country: rec.country ?? '',
              // Store the known label so the picker shows "Spain" even if the selector
              // returns a different ID format or hasn't loaded yet.
              countryLabel: rec['country$_identifier'] ?? '',
              region: rec.region ?? '',
              regionLabel: rec['region$_identifier'] ?? '',
              shipToAddress: rec.shipToAddress === 'Y' || rec.shipToAddress === true,
              invoiceToAddress: rec.invoiceToAddress === 'Y' || rec.invoiceToAddress === true,
            });
          }
        })
        .catch(() => {})
        .finally(() => {
          if (!cancelled) setInitialLoading(false);
        });
    }

    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, bplLinkId]);

  // Reload region list when country selection changes
  useEffect(() => {
    let cancelled = false;

    if (!open || !form.country) {
      setRegions([]);
      setRegionSelectorBase('');
      setRegionOffset(0);
      setRegionHasMore(false);
      setRegionLoadingMore(false);
      regionLoadingMoreRef.current = false;
      setRegionsLoading(false);
      setRegionsLoadFailed(false);
      return;
    }

    const loadRegions = async () => {
      setRegionsLoading(true);
      setRegionsLoadFailed(false);
      setRegions([]);
      setRegionOffset(0);
      setRegionHasMore(false);
      setRegionLoadingMore(false);
      regionLoadingMoreRef.current = false;

      const selectorBases = [
        `${contactsApiBase}/locationAddress/selectors/C_Region_ID`,
        `${contactsApiBase}/intrastatAdquisitions/selectors/C_Region_ID`,
        `${contactsApiBase}/bankAccount/selectors/C_Region_ID`,
        `${contactsApiBase}/locationAddress/selectors/region`,
        `${contactsApiBase}/intrastatAdquisitions/selectors/region`,
        `${contactsApiBase}/bankAccount/selectors/region`,
      ];

      let resolvedBase = '';
      let resolvedItems = [];
      let resolvedHasMore = false;
      let fallbackSuccess = null;

      for (const baseUrl of selectorBases) {
        const params = buildSelectorParams({
          C_Country_ID: form.country,
          country: form.country,
          limit: String(SELECTOR_PAGE_SIZE),
          offset: '0',
        });

        try {
          const { items, hasMore } = await fetchSelectorPage(
            `${baseUrl}?${params.toString()}`,
            authHeader
          );

          if (!fallbackSuccess) {
            fallbackSuccess = { baseUrl, items, hasMore };
          }

          if (items.length > 0 || hasMore) {
            resolvedBase = baseUrl;
            resolvedItems = items;
            resolvedHasMore = hasMore;
            break;
          }
        } catch (_error) {
          // Try next selector source.
        }
      }

      if (!resolvedBase && fallbackSuccess) {
        resolvedBase = fallbackSuccess.baseUrl;
        resolvedItems = fallbackSuccess.items;
        resolvedHasMore = fallbackSuccess.hasMore;
      }

      if (cancelled) return;

      if (!resolvedBase) {
        setRegions([]);
        setRegionSelectorBase('');
        setRegionOffset(0);
        setRegionHasMore(false);
        setRegionsLoadFailed(true);
        setRegionsLoading(false);
        return;
      }

      setRegionSelectorBase(resolvedBase);
      setRegions(resolvedItems);
      setRegionOffset(resolvedItems.length);
      setRegionHasMore(resolvedHasMore && resolvedItems.length > 0);
      setRegionsLoading(false);
    };

    loadRegions();

    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.country, open]);

  useEffect(() => {
    if (!countryPickerOpen) {
      setCountryQuery('');
      return;
    }
    const timer = setTimeout(() => countrySearchRef.current?.focus(), 40);
    return () => clearTimeout(timer);
  }, [countryPickerOpen]);

  useEffect(() => {
    if (!regionPickerOpen) {
      setRegionQuery('');
      return;
    }
    const timer = setTimeout(() => regionSearchRef.current?.focus(), 40);
    return () => clearTimeout(timer);
  }, [regionPickerOpen]);

  useEffect(() => {
    if (!countryPickerOpen) return undefined;
    const sentinel = countryLoadMoreRef.current;
    if (!sentinel) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting) return;
        if (!countrySelectorBase || !countryHasMore || countriesLoading || countryLoadingMoreRef.current) {
          return;
        }

        countryLoadingMoreRef.current = true;
        setCountryLoadingMore(true);

        const params = buildSelectorParams({
          limit: String(SELECTOR_PAGE_SIZE),
          offset: String(countryOffset),
        });

        fetchSelectorPage(`${countrySelectorBase}?${params.toString()}`, authHeader)
          .then(({ items, hasMore }) => {
            setCountries(prev => [...prev, ...items]);
            setCountryOffset(prev => prev + items.length);
            setCountryHasMore(hasMore && items.length > 0);
          })
          .catch(() => {
            setCountryHasMore(false);
          })
          .finally(() => {
            countryLoadingMoreRef.current = false;
            setCountryLoadingMore(false);
          });
      },
      { threshold: 0.1 }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [
    countryPickerOpen,
    countrySelectorBase,
    countryHasMore,
    countryOffset,
    countriesLoading,
    token,
  ]);

  useEffect(() => {
    if (!regionPickerOpen) return undefined;
    const sentinel = regionLoadMoreRef.current;
    if (!sentinel) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting) return;
        if (
          !regionSelectorBase
          || !form.country
          || !regionHasMore
          || regionsLoading
          || regionLoadingMoreRef.current
        ) {
          return;
        }

        regionLoadingMoreRef.current = true;
        setRegionLoadingMore(true);

        const params = buildSelectorParams({
          C_Country_ID: form.country,
          country: form.country,
          limit: String(SELECTOR_PAGE_SIZE),
          offset: String(regionOffset),
        });

        fetchSelectorPage(`${regionSelectorBase}?${params.toString()}`, authHeader)
          .then(({ items, hasMore }) => {
            setRegions(prev => [...prev, ...items]);
            setRegionOffset(prev => prev + items.length);
            setRegionHasMore(hasMore && items.length > 0);
          })
          .catch(() => {
            setRegionHasMore(false);
          })
          .finally(() => {
            regionLoadingMoreRef.current = false;
            setRegionLoadingMore(false);
          });
      },
      { threshold: 0.1 }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [
    regionPickerOpen,
    regionSelectorBase,
    regionHasMore,
    regionOffset,
    regionsLoading,
    form.country,
    token,
  ]);

  function setField(key, value) {
    setForm(prev => {
      const next = { ...prev, [key]: value };
      if (key === 'country') next.region = '';
      return next;
    });
  }

  function handleCountrySelect(countryId) {
    const found = countryOptions.find(c => c.id === countryId);
    setForm(prev => ({
      ...prev,
      country: countryId,
      countryLabel: found?.label ?? '',
      region: '',
      regionLabel: '',
    }));
    setCountryPickerOpen(false);
    setRegionPickerOpen(false);
    setRegionQuery('');
  }

  function handleRegionSelect(regionId) {
    const found = regionOptions.find(r => r.id === regionId);
    setForm(prev => ({
      ...prev,
      region: regionId,
      regionLabel: found?.label ?? '',
    }));
    setRegionPickerOpen(false);
  }

  async function handleDelete() {
    if (saving || !bplLinkId) return;
    setSaving(true);
    try {
      const res = await fetch(`${contactsApiBase}/locationAddress/${bplLinkId}`, {
        method: 'DELETE',
        headers: authHeader,
      });
      if (res.ok) onSaved?.();
    } finally {
      setSaving(false);
    }
  }

  async function handleSave() {
    if (saving || initialLoading) return;
    if (!form.country) {
      toast.error(ui('locationCountryRequired'));
      return;
    }
    setSaving(true);
    try {
      const name = [form.city, form.address].filter(Boolean).join(', ') || 'Location';
      const payload = {
        name,
        addressLine1: form.address || null,
        addressLine2: form.address2 || null,
        postalCode: form.postalCode || null,
        cityName: form.city || null,
        country: form.country || null,
        region: form.region || null,
        shipToAddress: form.shipToAddress ? 'Y' : 'N',
        invoiceToAddress: form.invoiceToAddress ? 'Y' : 'N',
      };
      const postHeaders = { ...authHeader, 'Content-Type': 'application/json' };

      if (bplLinkId) {
        // EDIT: ContactsLocationAddressHandler updates C_Location + C_BPartner_Location atomically
        const res = await fetch(`${contactsApiBase}/locationAddress/${bplLinkId}`, {
          method: 'PUT',
          headers: postHeaders,
          body: JSON.stringify(payload),
        });
        if (res.ok) onSaved?.();
        return;
      }

      // CREATE: ContactsLocationAddressHandler creates C_Location + C_BPartner_Location atomically
      const res = await fetch(`${contactsApiBase}/locationAddress?parentId=${bpId}`, {
        method: 'POST',
        headers: postHeaders,
        body: JSON.stringify({ ...payload, businessPartner: bpId }),
      });

      if (!res.ok) {
        console.error('[LocationEditorModal] locationAddress POST failed with status', res.status);
        return;
      }

      const data = await res.json();
      if ((data?.response?.status ?? 0) !== 0) {
        console.error('[LocationEditorModal] locationAddress POST returned NEO error:', data?.response);
        return;
      }

      onSaved?.();
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-gray-900">
            {ui('locationSelectorTitle')}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {initialLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={20} className="animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="flex flex-col gap-3">

            {/* 1st line */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                {ui('addressLine1')}
              </label>
              <input
                autoFocus
                type="text"
                value={form.address}
                onChange={e => setField('address', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* 2nd line */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                {ui('addressLine2')}
              </label>
              <input
                type="text"
                value={form.address2}
                onChange={e => setField('address2', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Postal code + City */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  {ui('postalCodeLabel')}
                </label>
                <input
                  type="text"
                  value={form.postalCode}
                  onChange={e => setField('postalCode', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  {ui('cityLabel')}
                </label>
                <input
                  type="text"
                  value={form.city}
                  onChange={e => setField('city', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Country */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                {ui('countryLabel')}
              </label>
              <button
                type="button"
                onClick={() => setCountryPickerOpen(true)}
                aria-haspopup="dialog"
                aria-expanded={countryPickerOpen}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors flex items-center justify-between gap-2"
              >
                <span className={`truncate ${form.country ? 'text-gray-900' : 'text-gray-500'}`}>
                  {selectedCountryLabel}
                </span>
                <ChevronDown size={16} className="text-gray-500 shrink-0" />
              </button>
            </div>

            {/* Region */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                {ui('regionLabel')}
              </label>
              <button
                type="button"
                onClick={() => {
                  if (form.country) setRegionPickerOpen(true);
                }}
                disabled={!form.country}
                aria-haspopup="dialog"
                aria-expanded={regionPickerOpen}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors flex items-center justify-between gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className={`truncate ${form.region ? 'text-gray-900' : 'text-gray-500'}`}>
                  {!form.country ? ui('selectCountryFirst') : selectedRegionLabel}
                </span>
                <ChevronDown size={16} className="text-gray-500 shrink-0" />
              </button>
            </div>

            {/* Shipping / Invoicing Address checkboxes */}
            <div className="flex gap-6 pt-1">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={form.shipToAddress}
                  onChange={e => setField('shipToAddress', e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">{t('IsShipTo') || 'Shipping Address'}</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={form.invoiceToAddress}
                  onChange={e => setField('invoiceToAddress', e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">{t('IsBillTo') || 'Invoicing Address'}</span>
              </label>
            </div>

          </div>
        )}

        {countryPickerOpen && (
          <div
            className="fixed inset-0 z-60 flex items-center justify-center bg-black/30 p-4"
            onMouseDown={() => setCountryPickerOpen(false)}
          >
            <div
              className="w-full max-w-md max-h-[540px] bg-white rounded-xl shadow-2xl flex flex-col"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
                <h3 className="text-sm font-semibold text-gray-900">{ui('countryLabel')}</h3>
                <button
                  type="button"
                  onClick={() => setCountryPickerOpen(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                  aria-label={ui('cancel')}
                >
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
                  filteredCountries.map(country => (
                    <button
                      key={country.id}
                      type="button"
                      onClick={() => handleCountrySelect(country.id)}
                      className={[
                        'w-full flex items-center gap-2 px-4 py-2.5 text-sm text-left hover:bg-gray-50',
                        form.country === country.id ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-800',
                      ].join(' ')}
                    >
                      <span className="w-4 shrink-0">
                        {form.country === country.id ? <Check size={14} /> : null}
                      </span>
                      <span className="truncate">{country.label}</span>
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
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
                <h3 className="text-sm font-semibold text-gray-900">{ui('regionLabel')}</h3>
                <button
                  type="button"
                  onClick={() => setRegionPickerOpen(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                  aria-label={ui('cancel')}
                >
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
                  filteredRegions.map(region => (
                    <button
                      key={region.id}
                      type="button"
                      onClick={() => handleRegionSelect(region.id)}
                      className={[
                        'w-full flex items-center gap-2 px-4 py-2.5 text-sm text-left hover:bg-gray-50',
                        form.region === region.id ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-800',
                      ].join(' ')}
                    >
                      <span className="w-4 shrink-0">
                        {form.region === region.id ? <Check size={14} /> : null}
                      </span>
                      <span className="truncate">{region.label}</span>
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

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 mt-6">
          <div>
            {bplLinkId && (
              <button
                onClick={handleDelete}
                disabled={saving || initialLoading}
                className="px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
              >
                {ui('removeLocation')}
              </button>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              {ui('cancel')}
            </button>
            <button
              onClick={handleSave}
              disabled={saving || initialLoading}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {saving && <Loader2 size={13} className="animate-spin" />}
              {ui('save')}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

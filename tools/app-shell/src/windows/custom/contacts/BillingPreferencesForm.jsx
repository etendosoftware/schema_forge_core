import { useState, useEffect, useMemo } from 'react';
import { EntityForm } from '@/components/contract-ui';
import { ChevronDown, ChevronRight, MapPin, Tag } from 'lucide-react';
import { useUI } from '@/i18n';
import LocationEditorModal from './LocationEditorModal';

const PRE_SAVE_BILLING_PREF_FIELDS = [
  'priceList',
  'paymentMethod',
  'paymentTerms',
  'account',
  'customerBlocking',
  'purchasePricelist',
  'pOPaymentMethod',
  'pOPaymentTerms',
  'pOFinancialAccount',
  'vendorBlocking',
];

function resolveId(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'object') {
    const id = value.id ?? value.value ?? null;
    return id == null || id === '' ? null : String(id);
  }
  return String(value);
}

// ─── Discount select ────────────────────────────────────────────────────────

function DiscountSelect({ value, options, onChange, loading }) {
  const ui = useUI();
  return (
    <div className="relative">
      <div className="flex items-center gap-1.5 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none z-10">
        <Tag size={13} className="text-muted-foreground" />
      </div>
      <select
        className="h-9 w-full rounded-md border border-input bg-background pl-8 pr-3 text-sm appearance-none cursor-pointer hover:border-ring transition-colors disabled:opacity-50"
        value={value ?? ''}
        onChange={e => onChange(e.target.value || null)}
        disabled={loading}
      >
        <option value="">{ui('none')}</option>
        {options.map(o => (
          <option key={o.id} value={o.id}>{o._identifier}</option>
        ))}
      </select>
      <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground" />
    </div>
  );
}

// ─── Main component ─────────────────────────────────────────────────────────

export default function BillingPreferencesForm(props) {
  const ui = useUI();
  const { data, api, token, onChange } = props;
  const bpId = data?.id;
  const canEditBillingPreferences = Boolean(bpId);
  const apiBase = api?.baseUrl ?? '';
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const organizationId = resolveId(data?.organization ?? data?.adOrgId ?? data?.ad_org_id);
  const clientId = resolveId(data?.client ?? data?.adClientId ?? data?.ad_client_id);
  const [locationModalOpen, setLocationModalOpen] = useState(false);

  const selectorContext = useMemo(() => {
    const ctx = {};
    if (organizationId) ctx.AD_Org_ID = organizationId;
    if (clientId) ctx.AD_Client_ID = clientId;
    if (bpId) ctx.parentId = bpId;
    return ctx;
  }, [organizationId, clientId, bpId]);

  // Sub-entity records (current BP's discount + address)
  const [discountRecord, setDiscountRecord] = useState(undefined); // undefined=loading, null=none
  const [addressRecord, setAddressRecord] = useState(undefined);
  // Available discount catalog
  const [discountOptions, setDiscountOptions] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!bpId || !token) return;

    // Fetch current discount record for this BP
    fetch(`${apiBase}/basicDiscount?parentId=${bpId}&_startRow=0&_endRow=1`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(d => setDiscountRecord(d?.response?.data?.[0] ?? null))
      .catch(() => setDiscountRecord(null));

    // Fetch current location/address record for this BP
    fetch(`${apiBase}/locationAddress?parentId=${bpId}&_startRow=0&_endRow=1`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(d => setAddressRecord(d?.response?.data?.[0] ?? null))
      .catch(() => setAddressRecord(null));

    // Fetch available discounts catalog
    const discountParams = new URLSearchParams({ limit: '200', offset: '0' });
    if (organizationId) discountParams.set('AD_Org_ID', organizationId);
    if (clientId) discountParams.set('AD_Client_ID', clientId);
    fetch(`${apiBase}/basicDiscount/selectors/C_Discount_ID?${discountParams.toString()}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        const seen = new Set();
        const options = [];
        (d?.items ?? []).forEach((item) => {
          if (!item?.id || seen.has(item.id)) return;
          seen.add(item.id);
          options.push({ id: item.id, _identifier: item.label || item.name || item.id });
        });
        setDiscountOptions(options);
      })
      .catch(() => setDiscountOptions([]))
      .finally(() => setDiscountRecord(prev => prev === undefined ? null : prev)); // Clear loading state on error
  }, [bpId, token, apiBase, organizationId, clientId]);

  // In Classic, billing preferences are set after the Business Partner exists.
  // Keep the pre-save create payload clean by removing auto-defaulted billing values
  // that can come from backend preferences in /defaults.
  useEffect(() => {
    if (canEditBillingPreferences || typeof onChange !== 'function') return;

    const hasPrefilledBillingValues = PRE_SAVE_BILLING_PREF_FIELDS.some((key) => {
      const value = data?.[key];
      return value != null && value !== '';
    });

    if (!hasPrefilledBillingValues) return;

    PRE_SAVE_BILLING_PREF_FIELDS.forEach((key) => {
      if (data?.[key] != null && data[key] !== '') {
        onChange(key, null);
      }
      const identifierKey = `${key}$_identifier`;
      if (data?.[identifierKey] != null && data[identifierKey] !== '') {
        onChange(identifierKey, null);
      }
    });
  }, [canEditBillingPreferences, data, onChange]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  async function refreshAddressRecord() {
    const d = await fetch(
      `${apiBase}/locationAddress?parentId=${bpId}&_startRow=0&_endRow=1`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
      .then(r => (r.ok ? r.json() : null))
      .catch(() => null);
    setAddressRecord(d?.response?.data?.[0] ?? null);
  }

  async function handleDiscountChange(newDiscountId) {
    if (saving) return;
    setSaving(true);
    try {
      if (!newDiscountId && discountRecord?.id) {
        // Clear: delete existing record
        await fetch(`${apiBase}/basicDiscount/${discountRecord.id}`, { method: 'DELETE', headers });
        setDiscountRecord(null);
      } else if (discountRecord?.id) {
        // Update existing record
        const res = await fetch(`${apiBase}/basicDiscount/${discountRecord.id}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify({ discount: newDiscountId }),
        });
        if (res.ok) {
          const d = await res.json();
          setDiscountRecord(d?.response?.data?.[0] ?? { ...discountRecord, discount: newDiscountId });
        }
      } else if (newDiscountId) {
        // Create new record with required auto-flags
        const res = await fetch(`${apiBase}/basicDiscount?parentId=${bpId}`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            discount: newDiscountId,
            lineNo: 10,
            applyInOrder: 'Y',
            customer: data?.customer ? 'Y' : 'N',
            vendor: data?.vendor ? 'Y' : 'N',
          }),
        });
        if (res.ok) {
          const d = await res.json();
          setDiscountRecord(d?.response?.data?.[0] ?? null);
        }
      }
    } finally {
      setSaving(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const discountLoading = discountRecord === undefined;
  const addressLoading = addressRecord === undefined;
  const currentDiscountId = discountRecord?.discount ?? null;
  const currentAddress = addressRecord
    ? { id: addressRecord.locationAddress, _identifier: addressRecord['locationAddress$_identifier'] ?? '' }
    : null;

  const customerCheckboxField = [
    { key: 'customer', column: 'IsCustomer', type: 'checkbox', label: ui('customer'), required: true, section: 'principal' },
  ];

  const customerBillingFields = [
    { key: 'priceList', column: 'M_PriceList_ID', type: 'selector', section: 'principal', inputMode: 'selector' },
    { key: 'paymentMethod', column: 'FIN_Paymentmethod_ID', type: 'selector', section: 'principal', inputMode: 'selector' },
    { key: 'paymentTerms', column: 'C_PaymentTerm_ID', type: 'selector', section: 'principal', inputMode: 'selector' },
    { key: 'account', column: 'FIN_Financial_Account_ID', type: 'selector', section: 'principal', inputMode: 'selector' },
    { key: 'customerBlocking', column: 'Customer_Blocking', type: 'checkbox', section: 'principal' },
  ];

  const vendorCheckboxField = [
    { key: 'vendor', column: 'IsVendor', type: 'checkbox', label: ui('vendor'), required: true, section: 'principal' },
  ];

  const vendorBillingFields = [
    { key: 'purchasePricelist', column: 'PO_PriceList_ID', type: 'selector', section: 'principal', inputMode: 'selector' },
    { key: 'pOPaymentMethod', column: 'PO_Paymentmethod_ID', type: 'selector', section: 'principal', inputMode: 'selector' },
    { key: 'pOPaymentTerms', column: 'PO_PaymentTerm_ID', type: 'selector', section: 'principal', inputMode: 'selector' },
    { key: 'pOFinancialAccount', column: 'PO_Financial_Account_ID', type: 'selector', section: 'principal', inputMode: 'selector' },
    { key: 'vendorBlocking', column: 'Vendor_Blocking', type: 'checkbox', section: 'principal' },
  ];

  return (
    <>
    <div className="flex flex-col gap-4">

      {/* ── Discount + Address inline fields ─────────────────────────── */}
      {bpId && (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {/* Basic Discount */}
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground">{ui('basicDiscount')}</span>
              <DiscountSelect
                value={currentDiscountId}
                options={discountOptions}
                onChange={handleDiscountChange}
                loading={discountLoading || saving}
              />
            </div>

            {/* Location / Address */}
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground">{ui('locationAddress')}</span>
              {addressLoading
                ? <div className="h-9 rounded-md bg-muted animate-pulse" />
                : (
                  <button
                    type="button"
                    className="flex items-center gap-2 h-9 rounded-md border border-input bg-background px-3 text-sm text-left hover:border-ring transition-colors"
                    onClick={() => setLocationModalOpen(true)}
                  >
                    <MapPin size={13} className="text-muted-foreground shrink-0" />
                    <span className={`flex-1 truncate ${currentAddress?._identifier ? '' : 'text-muted-foreground'}`}>
                      {currentAddress?._identifier || ui('setLocation')}
                    </span>
                    <ChevronRight size={13} className="text-muted-foreground shrink-0" />
                  </button>
                )
              }
            </div>
          </div>

          <div className="border-t border-border" />
        </>
      )}

      {!canEditBillingPreferences ? (
        <div className="rounded-md border border-dashed border-border px-3 py-2 text-sm text-muted-foreground">
          {ui('billingPreferencesAfterSave')}
        </div>
      ) : (
        <>
          {/* ── Customer / Vendor billing ─────────────────────────────────── */}
          <EntityForm {...props} fields={customerCheckboxField} selectorContext={selectorContext} />
          {data?.customer && (
            <div className="pl-4 border-l-2 border-border">
              <EntityForm {...props} fields={customerBillingFields} selectorContext={selectorContext} />
            </div>
          )}

          <EntityForm {...props} fields={vendorCheckboxField} selectorContext={selectorContext} />
          {data?.vendor && (
            <div className="pl-4 border-l-2 border-border">
              <EntityForm {...props} fields={vendorBillingFields} selectorContext={selectorContext} />
            </div>
          )}
        </>
      )}
    </div>

    {bpId && (
      <LocationEditorModal
        open={locationModalOpen}
        onClose={() => setLocationModalOpen(false)}
        onSaved={async () => {
          await refreshAddressRecord();
          setLocationModalOpen(false);
        }}
        bplId={addressRecord?.id ?? null}
        bpId={bpId}
        contactsApiBase={apiBase}
        token={token}
        selectorContext={selectorContext}
      />
    )}
    </>
  );
}

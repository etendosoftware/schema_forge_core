import { useEffect, useMemo, useRef, useState } from 'react';
import { EntityForm } from '@/components/contract-ui';
import { useUI } from '@/i18n';
import BillingPreferencesForm from './BillingPreferencesForm';

function FieldGroup({ title, description, children }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="text-sm font-semibold text-gray-800">{title}</div>
          {description && <div className="text-xs text-gray-400 mt-0.5">{description}</div>}
        </div>
      </div>
      {children}
    </div>
  );
}

export default function ContactsFinancialPanel({ data, token, apiBaseUrl, catalogs, api, editing, onChange }) {
  const ui = useUI();
  const [creditTaxDraft, setCreditTaxDraft] = useState({});
  const [savingField, setSavingField] = useState(null);
  const draftRef = useRef({});

  useEffect(() => {
    const nextDraft = {
      creditLimit: data?.creditLimit ?? '',
      creditUsed: data?.creditUsed ?? '',
      taxID: data?.taxID ?? '',
      active: data?.active ?? true,
    };
    setCreditTaxDraft(nextDraft);
    draftRef.current = nextDraft;
  }, [data?.creditLimit, data?.creditUsed, data?.taxID, data?.active]);

  const creditTaxReadOnly = useMemo(() => (
    editing ? {} : { creditLimit: true, creditUsed: true, taxID: true, active: true }
  ), [editing]);

  async function persistCreditTaxField(fieldKey) {
    if (!data?.id || !apiBaseUrl || !token) return;
    if (creditTaxReadOnly[fieldKey]) return;

    const currentValue = draftRef.current[fieldKey] ?? '';
    const originalValue = data?.[fieldKey] ?? '';
    if (String(currentValue ?? '') === String(originalValue ?? '')) return;

    setSavingField(fieldKey);
    try {
      const normalizedValue = fieldKey === 'creditLimit'
        ? (currentValue === '' || currentValue == null ? null : Number(currentValue))
        : (currentValue === '' ? null : currentValue);
      const payload = { [fieldKey]: normalizedValue };
      const res = await fetch(`${apiBaseUrl}/businessPartner/${data.id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        setCreditTaxDraft(prev => ({ ...prev, [fieldKey]: originalValue }));
        draftRef.current = { ...draftRef.current, [fieldKey]: originalValue };
        return;
      }

      const responseData = await res.json().catch(() => null);
      const saved = responseData?.response?.data?.[0] ?? responseData;
      const finalValue = saved?.[fieldKey] ?? payload[fieldKey];
      const nextDraft = { ...draftRef.current, [fieldKey]: finalValue ?? '' };
      draftRef.current = nextDraft;
      setCreditTaxDraft(nextDraft);
      if (saved && typeof onChange === 'function') {
        onChange(fieldKey, finalValue);
      }
    } finally {
      setSavingField(null);
    }
  }

  function handleCreditTaxChange(fieldKey, value) {
    const next = { ...draftRef.current, [fieldKey]: value };
    draftRef.current = next;
    setCreditTaxDraft(next);
  }

  const creditFields = [
    { key: 'creditLimit', column: 'SO_CreditLimit', type: 'number', required: true, section: 'other' },
    { key: 'creditUsed', column: 'SO_CreditUsed', type: 'number', required: true, readOnly: true, section: 'other' },
    { key: 'taxID', column: 'TaxID', type: 'text', section: 'other' },
    { key: 'active', column: 'IsActive', type: 'checkbox', required: true, readOnly: true, section: 'other', defaultValue: 'Y' },
  ];

  return (
    <div className="space-y-4 pb-6">
      <FieldGroup title={ui('creditTax')} description={ui('creditTaxDescription')}>
        <EntityForm
          fields={creditFields}
          data={creditTaxDraft}
          onChange={handleCreditTaxChange}
          catalogs={catalogs}
          layout="horizontal"
          displayLogic={{
            readOnly: creditTaxReadOnly,
            visibility: {},
          }}
          api={api}
          token={token}
          apiBaseUrl={apiBaseUrl}
          onFieldBlur={persistCreditTaxField}
          savingField={savingField}
        />
      </FieldGroup>
      <FieldGroup title={ui('billingPreferences')} description={ui('billingPreferencesDesc')}>
        <BillingPreferencesForm
          data={data}
          entity="businessPartner"
          api={api}
          token={token}
          catalogs={catalogs}
          onChange={onChange}
          editing={editing}
          apiBaseUrl={apiBaseUrl}
        />
      </FieldGroup>
    </div>
  );
}

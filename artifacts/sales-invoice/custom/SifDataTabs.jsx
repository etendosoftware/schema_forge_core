import { useState, useMemo } from 'react';
import { toast } from 'sonner';
import { useFiscalConfig } from '@/windows/custom/fiscal-config/useFiscalConfig.js';
import { useAuth } from '@/auth/AuthContext';

const SII_PROFILES = new Set(['sii', 'sii-navarra', 'sii+tbai']);
const TBAI_PROFILES = new Set(['tbai', 'sii+tbai']);

const CLAVE_TIPO_OPTIONS = [
  { value: 'F1', label: 'Invoice' },
  { value: 'F2', label: 'Simplified invoice' },
  { value: 'F4', label: 'Simplified invoices summary' },
  { value: 'R', label: 'Corrective invoice' },
];

function Field({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <span style={{ fontSize: '12px', color: '#6b7280', fontWeight: 500 }}>{label}</span>
      {children}
    </div>
  );
}

function ReadValue({ value }) {
  return (
    <span style={{ fontSize: '14px', color: '#111827', padding: '6px 0' }}>
      {value ?? '—'}
    </span>
  );
}

const INPUT_STYLE = {
  fontSize: '14px',
  border: '1px solid #e5e7eb',
  borderRadius: '6px',
  padding: '6px 10px',
  color: '#111827',
  background: '#fff',
  width: '100%',
  boxSizing: 'border-box',
};

export default function SifDataTabs({ data, recordId, token, apiBaseUrl }) {
  const { selectedOrg } = useAuth();
  const orgId = selectedOrg?.id ?? null;
  const base = useMemo(() => (apiBaseUrl || '').replace(/\/[^/]+$/, ''), [apiBaseUrl]);
  const headers = useMemo(() => ({
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }), [token]);

  const { profile } = useFiscalConfig(orgId, token, apiBaseUrl);

  const showSii = SII_PROFILES.has(profile);
  const showTbai = TBAI_PROFILES.has(profile);

  const [activeTab, setActiveTab] = useState('sii');
  const [siiForm, setSiiForm] = useState({});
  const [savingField, setSavingField] = useState(null);

  if (!showSii && !showTbai) return null;

  const effectiveTab = (!showSii && activeTab === 'sii' && showTbai) ? 'tbai' : activeTab;

  function getVal(key) {
    return key in siiForm ? siiForm[key] : (data?.[key] ?? '');
  }

  function setVal(key, value) {
    setSiiForm(prev => ({ ...prev, [key]: value }));
  }

  async function patchField(fieldKey, value) {
    setSavingField(fieldKey);
    try {
      const res = await fetch(`${base}/sales-invoice/header/${recordId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ [fieldKey]: value }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.response?.message || json?.message || `HTTP ${res.status}`);
      }
    } catch (err) {
      toast.error(err.message || 'Error saving field');
      setSiiForm(prev => ({ ...prev, [fieldKey]: data?.[fieldKey] ?? '' }));
    } finally {
      setSavingField(null);
    }
  }

  function handleBlur(fieldKey, value) {
    if (String(value) === String(data?.[fieldKey] ?? '')) return;
    patchField(fieldKey, value);
  }

  function handleCheckboxChange(fieldKey, checked) {
    setVal(fieldKey, checked);
    patchField(fieldKey, checked);
  }

  const TAB_STYLE_ACTIVE = {
    padding: '6px 16px', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
    color: '#1d4ed8', background: 'none', border: 'none',
    borderBottom: '2px solid #1d4ed8',
  };
  const TAB_STYLE_INACTIVE = {
    padding: '6px 16px', fontSize: '13px', fontWeight: 500, cursor: 'pointer',
    color: '#6b7280', background: 'none', border: 'none', borderBottom: '2px solid transparent',
  };

  return (
    <div style={{ marginBottom: '16px', border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' }}>
      <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', background: '#f9fafb' }}>
        {showSii && (
          <button
            type="button"
            style={effectiveTab === 'sii' ? TAB_STYLE_ACTIVE : TAB_STYLE_INACTIVE}
            onClick={() => setActiveTab('sii')}
          >
            SII
          </button>
        )}
        {showTbai && (
          <button
            type="button"
            style={effectiveTab === 'tbai' ? TAB_STYLE_ACTIVE : TAB_STYLE_INACTIVE}
            onClick={() => setActiveTab('tbai')}
          >
            TBAI
          </button>
        )}
      </div>

      <div style={{ padding: '16px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
        {effectiveTab === 'sii' && showSii && (
          <>
            <Field label="Fecha operación">
              <input
                type="date"
                style={INPUT_STYLE}
                value={getVal('aeatsiiFechaOperacion')}
                onChange={e => setVal('aeatsiiFechaOperacion', e.target.value)}
                onBlur={e => handleBlur('aeatsiiFechaOperacion', e.target.value)}
                disabled={savingField === 'aeatsiiFechaOperacion'}
              />
            </Field>

            <Field label="Tipo de factura SII">
              <select
                style={INPUT_STYLE}
                value={getVal('aeatsiiClaveTipo')}
                onChange={e => setVal('aeatsiiClaveTipo', e.target.value)}
                onBlur={e => handleBlur('aeatsiiClaveTipo', e.target.value)}
                disabled={savingField === 'aeatsiiClaveTipo'}
              >
                <option value="">—</option>
                {CLAVE_TIPO_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.value} — {o.label}</option>
                ))}
              </select>
            </Field>

            <Field label="Descripción maestra SII">
              <ReadValue value={data?.['aeatsiiDescription$_identifier']} />
            </Field>

            <Field label="Descripción SII">
              <input
                type="text"
                style={INPUT_STYLE}
                value={getVal('aeatsiiDescripcionSii')}
                onChange={e => setVal('aeatsiiDescripcionSii', e.target.value)}
                onBlur={e => handleBlur('aeatsiiDescripcionSii', e.target.value)}
                disabled={savingField === 'aeatsiiDescripcionSii'}
              />
            </Field>

            <Field label="Causa de exención SII">
              <ReadValue value={data?.['aeatsiiCauseExemption$_identifier']} />
            </Field>

            <Field label="Autorización">
              <div style={{ display: 'flex', alignItems: 'center', height: '34px' }}>
                <input
                  type="checkbox"
                  checked={Boolean(getVal('aeatsiiIsauthorization'))}
                  onChange={e => handleCheckboxChange('aeatsiiIsauthorization', e.target.checked)}
                  disabled={savingField === 'aeatsiiIsauthorization'}
                  style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                />
              </div>
            </Field>

            <Field label="Ejercicio SII">
              <ReadValue value={data?.aeatsiiEjercicio} />
            </Field>

            <Field label="Periodo SII">
              <ReadValue value={data?.aeatsiiPeriodo} />
            </Field>
          </>
        )}

        {effectiveTab === 'tbai' && showTbai && (
          <>
            <Field label="Secuencia de encadenamiento">
              <ReadValue value={data?.tbaiSequence} />
            </Field>

            <Field label="Serie factura">
              <ReadValue value={data?.tbaiInvoicenum} />
            </Field>

            <Field label="Secuencia factura">
              <ReadValue value={data?.tbaiInvoiceseq} />
            </Field>
          </>
        )}
      </div>
    </div>
  );
}

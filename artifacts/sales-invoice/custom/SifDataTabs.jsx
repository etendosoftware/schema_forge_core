import { useState, useMemo } from 'react';
import { toast } from 'sonner';
import { useFiscalConfig } from '@/windows/custom/fiscal-config/useFiscalConfig.js';
import { normalizeDateInputValue } from '@/windows/custom/fiscal-config/fiscalConfig.utils.js';
import { useAuth } from '@/auth/AuthContext';

const SII_PROFILES = new Set(['sii', 'sii-navarra', 'sii+tbai']);
const TBAI_PROFILES = new Set(['tbai', 'sii+tbai']);

const CLAVE_TIPO_OPTIONS = [
  { value: 'F1', label: 'Invoice' },
  { value: 'F2', label: 'Simplified invoice' },
  { value: 'F4', label: 'Simplified invoices summary' },
  { value: 'R', label: 'Corrective invoice' },
];

function FieldRow({ label, children }) {
  return (
    <div className="flex items-start gap-2 min-w-0">
      <span className="text-[11px] text-muted-foreground shrink-0 w-28 pt-0.5 leading-tight">{label}</span>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

function ReadValue({ value }) {
  return (
    <span className="text-xs text-foreground">
      {value ?? <span className="text-muted-foreground/40">—</span>}
    </span>
  );
}

const inputCls = 'w-full text-xs bg-white border rounded px-2 py-0.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30 disabled:opacity-50 border-border/40';

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

  function getDateVal(key) {
    return key in siiForm ? siiForm[key] : normalizeDateInputValue(data?.[key] ?? '');
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

  return (
    <div className="flex items-start gap-3 px-3 pt-3 pb-3 border-t border-border/40" style={{ borderTopWidth: '0.5px' }}>
      {/* Section label + tab switcher stacked */}
      <div className="shrink-0 w-24">
        <span className="text-[11px] font-medium text-foreground uppercase block mb-1.5" style={{ letterSpacing: '0.04em' }}>
          SIF
        </span>
        <div className="flex flex-col gap-0.5">
          {showSii && (
            <button
              type="button"
              onClick={() => setActiveTab('sii')}
              className={`text-[10px] font-medium px-1.5 py-0.5 rounded text-left transition-colors ${
                effectiveTab === 'sii'
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              SII
            </button>
          )}
          {showTbai && (
            <button
              type="button"
              onClick={() => setActiveTab('tbai')}
              className={`text-[10px] font-medium px-1.5 py-0.5 rounded text-left transition-colors ${
                effectiveTab === 'tbai'
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              TBAI
            </button>
          )}
        </div>
      </div>

      {/* Fields */}
      <div className="flex-1 min-w-0">
        {effectiveTab === 'sii' && showSii && (
          <div className="flex flex-col gap-1.5">
            <FieldRow label="Fecha operación">
              <input
                type="date"
                className={inputCls}
                style={{ borderWidth: '0.5px' }}
                value={getDateVal('aeatsiiFechaOperacion')}
                onChange={e => setVal('aeatsiiFechaOperacion', e.target.value)}
                onBlur={e => handleBlur('aeatsiiFechaOperacion', e.target.value)}
                disabled={savingField === 'aeatsiiFechaOperacion'}
              />
            </FieldRow>
            <FieldRow label="Tipo factura">
              <select
                className={inputCls}
                style={{ borderWidth: '0.5px' }}
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
            </FieldRow>
            <FieldRow label="Descripción maestra">
              <ReadValue value={data?.['aeatsiiDescription$_identifier']} />
            </FieldRow>
            <FieldRow label="Descripción SII">
              <input
                type="text"
                className={inputCls}
                style={{ borderWidth: '0.5px' }}
                value={getVal('aeatsiiDescripcionSii')}
                onChange={e => setVal('aeatsiiDescripcionSii', e.target.value)}
                onBlur={e => handleBlur('aeatsiiDescripcionSii', e.target.value)}
                disabled={savingField === 'aeatsiiDescripcionSii'}
              />
            </FieldRow>
            <FieldRow label="Causa exención">
              <ReadValue value={data?.['aeatsiiCauseExemption$_identifier']} />
            </FieldRow>
            <FieldRow label="Autorización">
              <input
                type="checkbox"
                checked={Boolean(getVal('aeatsiiIsauthorization'))}
                onChange={e => handleCheckboxChange('aeatsiiIsauthorization', e.target.checked)}
                disabled={savingField === 'aeatsiiIsauthorization'}
                className="mt-0.5 cursor-pointer"
              />
            </FieldRow>
            <FieldRow label="Ejercicio SII">
              <ReadValue value={data?.aeatsiiEjercicio} />
            </FieldRow>
            <FieldRow label="Periodo SII">
              <ReadValue value={data?.aeatsiiPeriodo} />
            </FieldRow>
          </div>
        )}

        {effectiveTab === 'tbai' && showTbai && (
          <div className="flex flex-col gap-1.5">
            <FieldRow label="Secuencia encadenamiento">
              <ReadValue value={data?.tbaiSequence} />
            </FieldRow>
            <FieldRow label="Serie factura">
              <ReadValue value={data?.tbaiInvoicenum} />
            </FieldRow>
            <FieldRow label="Secuencia factura">
              <ReadValue value={data?.tbaiInvoiceseq} />
            </FieldRow>
          </div>
        )}
      </div>
    </div>
  );
}

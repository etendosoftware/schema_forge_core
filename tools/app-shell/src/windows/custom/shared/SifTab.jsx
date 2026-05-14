import { useState, useMemo } from 'react';
import { toast } from 'sonner';
import { useUI } from '@/i18n';
import { useFiscalConfig } from '@/windows/custom/fiscal-config/useFiscalConfig.js';
import { normalizeDateInputValue } from '@/windows/custom/fiscal-config/fiscalConfig.utils.js';
import { useAuth } from '@/auth/AuthContext';
import { getInvoiceFiscalTargets } from '@/windows/custom/shared/fiscalTargets.js';

const CLAVE_TIPO_OPTIONS = [
  { value: 'F1', labelKey: 'sifDataTabs.option.invoice' },
  { value: 'F2', labelKey: 'sifDataTabs.option.simplifiedInvoice' },
  { value: 'F4', labelKey: 'sifDataTabs.option.simplifiedInvoiceSummary' },
  { value: 'R', labelKey: 'sifDataTabs.option.correctiveInvoice' },
];

const PURCHASE_CLAVE_TIPO_FC_OPTIONS = [
  { value: 'F6', labelKey: 'sifDataTabs.option.accountingDocument' },
  { value: 'LC', labelKey: 'sifDataTabs.option.customsComplementarySettlement' },
  { value: 'F5', labelKey: 'sifDataTabs.option.importDua' },
  { value: 'F1', labelKey: 'sifDataTabs.option.invoice' },
];

const inputCls = 'w-full text-xs bg-white border rounded px-2 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30 disabled:opacity-50 border-border/40';

const SII_STATUS = {
  CO: { key: 'sifDataTabs.status.sii.correct', cls: 'bg-green-50 text-green-700 border-green-200' },
  AE: { key: 'sifDataTabs.status.sii.acceptedWithErrors', cls: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  IN: { key: 'sifDataTabs.status.sii.incorrect', cls: 'bg-red-50 text-red-700 border-red-200' },
  EE: { key: 'sifDataTabs.status.sii.sendError', cls: 'bg-red-50 text-red-700 border-red-200' },
  PE: { key: 'sifDataTabs.status.sii.pending', cls: 'bg-gray-50 text-gray-500 border-gray-200' },
  AN: { key: 'sifDataTabs.status.sii.cancelled', cls: 'bg-gray-50 text-gray-500 border-gray-200' },
  BA: { key: 'sifDataTabs.status.sii.dropped', cls: 'bg-gray-50 text-gray-500 border-gray-200' },
  NR: { key: 'sifDataTabs.status.sii.notRegistrable', cls: 'bg-gray-50 text-gray-500 border-gray-200' },
};

const VERIFACTU_STATUS = {
  AC: { key: 'sifDataTabs.status.verifactu.accepted', cls: 'bg-green-50 text-green-700 border-green-200' },
  AE: { key: 'sifDataTabs.status.verifactu.acceptedWithErrors', cls: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  IN: { key: 'sifDataTabs.status.verifactu.invalid', cls: 'bg-red-50 text-red-700 border-red-200' },
  ER: { key: 'sifDataTabs.status.verifactu.rejected', cls: 'bg-red-50 text-red-700 border-red-200' },
  PE: { key: 'sifDataTabs.status.verifactu.pending', cls: 'bg-gray-50 text-gray-500 border-gray-200' },
};

function SiiStatusBadge({ estado, ui }) {
  const current = SII_STATUS[estado] ?? {
    key: 'sifDataTabs.status.sii.notSent',
    cls: 'bg-gray-50 text-gray-400 border-gray-200',
  };
  return (
    <span className={`inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded border ${current.cls}`}>
      {ui(current.key)}
    </span>
  );
}

function TbaiBadge({ issent, ui }) {
  const sent = issent === true || issent === 'Y';
  return (
    <span className={`inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded border ${
      sent ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-50 text-gray-400 border-gray-200'
    }`}>
      {ui(sent ? 'sifDataTabs.status.tbai.sent' : 'sifDataTabs.status.tbai.notSent')}
    </span>
  );
}

function VerifactuBadge({ status, sent, ui }) {
  const normalized = status || (sent === true || sent === 'Y' ? 'AC' : null);
  const current = VERIFACTU_STATUS[normalized] ?? {
    key: 'sifDataTabs.status.verifactu.notSent',
    cls: 'bg-gray-50 text-gray-400 border-gray-200',
  };
  return (
    <span className={`inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded border ${current.cls}`}>
      {ui(current.key)}
    </span>
  );
}

function FieldRow({ label, children }) {
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <span className="text-[11px] text-muted-foreground leading-tight">{label}</span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function ReadValue({ value }) {
  return (
    <div className={`${inputCls} min-h-[36px] flex items-center`}>
      {value ?? <span className="text-muted-foreground/40">-</span>}
    </div>
  );
}

function getRailBadge(target, data, ui) {
  if (target === 'sii') {
    const current = SII_STATUS[data?.aeatsiiEstado] ?? {
      key: 'sifDataTabs.status.sii.notSent',
      cls: 'bg-gray-50 text-gray-400 border-gray-200',
    };
    return <span className={`inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded border ${current.cls}`}>{ui(current.key)}</span>;
  }
  if (target === 'tbai') {
    const sent = data?.tbaiIssent === true || data?.tbaiIssent === 'Y';
    return (
      <span className={`inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded border ${
        sent ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-50 text-gray-400 border-gray-200'
      }`}>
        {ui(sent ? 'sifDataTabs.status.tbai.sent' : 'sifDataTabs.status.tbai.notSent')}
      </span>
    );
  }
  if (target === 'verifactu') {
    const normalized = data?.etvfacInvoiceStatus || (data?.etvfacSentToVerifac === true || data?.etvfacSentToVerifac === 'Y' ? 'AC' : null);
    const current = VERIFACTU_STATUS[normalized] ?? {
      key: 'sifDataTabs.status.verifactu.notSent',
      cls: 'bg-gray-50 text-gray-400 border-gray-200',
    };
    return <span className={`inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded border ${current.cls}`}>{ui(current.key)}</span>;
  }
  return null;
}

export default function SifTab({ recordId, data, token, apiBaseUrl }) {
  const ui = useUI();
  const { selectedOrg } = useAuth();
  const orgId = selectedOrg?.id ?? null;
  const base = useMemo(() => (apiBaseUrl || '').replace(/\/[^/]+$/, ''), [apiBaseUrl]);
  const specName = apiBaseUrl?.split('/').filter(Boolean).pop() || 'sales-invoice';
  const headers = useMemo(() => ({
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }), [token]);

  const { profile } = useFiscalConfig(orgId, token, apiBaseUrl);
  const { showSii, showTbai, showVerifactu } = getInvoiceFiscalTargets(specName, profile);
  const isPurchaseInvoice = specName === 'purchase-invoice';
  const siiTypeField = isPurchaseInvoice ? 'aeatsiiClaveTipoFc' : 'aeatsiiClaveTipo';
  const siiDescriptionMasterIdentifier = isPurchaseInvoice
    ? data?.['aeatsiiPurDescription$_identifier']
    : data?.['aeatsiiDescription$_identifier'];
  const siiTypeOptions = isPurchaseInvoice ? PURCHASE_CLAVE_TIPO_FC_OPTIONS : CLAVE_TIPO_OPTIONS;

  const isDraft = data?.documentStatus === 'DR';
  const isSentToSii = data?.aeatsiiIssent === true || data?.aeatsiiIssent === 'Y';
  const dateReadOnly = !isDraft;
  const siiFieldReadOnly = isSentToSii;

  const defaultTab = showSii ? 'sii' : showTbai ? 'tbai' : 'verifactu';
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [siiForm, setSiiForm] = useState({});
  const [savingField, setSavingField] = useState(null);

  if (!showSii && !showTbai && !showVerifactu) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted-foreground p-8">
        {ui('sifDataTabs.sectionTitle')}
      </div>
    );
  }

  const effectiveTab = (activeTab === 'sii' && showSii)
    ? 'sii'
    : (activeTab === 'tbai' && showTbai)
      ? 'tbai'
      : (activeTab === 'verifactu' && showVerifactu)
        ? 'verifactu'
        : defaultTab;

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
      const res = await fetch(`${base}/${specName}/header/${recordId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ [fieldKey]: value }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.response?.message || json?.message || `HTTP ${res.status}`);
      }
    } catch (err) {
      toast.error(err.message || ui('sifDataTabs.errorSavingField'));
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

  const railItems = [
    showSii && { key: 'sii', labelKey: 'sifDataTabs.tab.sii' },
    showTbai && { key: 'tbai', labelKey: 'sifDataTabs.tab.tbai' },
    showVerifactu && { key: 'verifactu', labelKey: 'sifDataTabs.tab.verifactu' },
  ].filter(Boolean);

  return (
    <div className="flex gap-4 p-4 h-full min-h-0">
      <div className="w-56 shrink-0 flex flex-col gap-1 border border-border/40 rounded-lg bg-white p-2">
        {railItems.map(item => (
          <button
            key={item.key}
            type="button"
            onClick={() => setActiveTab(item.key)}
            className={`flex items-center justify-between gap-2 px-3 py-2 rounded-md cursor-pointer text-left transition-colors ${
              effectiveTab === item.key
                ? 'bg-gray-50 border-l-2 border-primary'
                : 'hover:bg-gray-50/60'
            }`}
          >
            <span className={`text-xs font-medium ${effectiveTab === item.key ? 'text-primary' : 'text-foreground'}`}>
              {ui(item.labelKey)}
            </span>
            {getRailBadge(item.key, data, ui)}
          </button>
        ))}
      </div>

      <div className="flex-1 border border-border/40 rounded-lg bg-white overflow-hidden flex flex-col min-h-0">
        {effectiveTab === 'sii' && showSii && (
          <>
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border/40">
              <span className="text-sm font-medium text-foreground">{ui('sifDataTabs.tab.sii')}</span>
              <SiiStatusBadge estado={data?.aeatsiiEstado} ui={ui} />
            </div>
            <div className="grid grid-cols-2 gap-x-5 gap-y-4 p-4 overflow-y-auto">
              <FieldRow label={ui('sifDataTabs.field.operationDate')}>
                <input
                  type="date"
                  className={inputCls}
                  value={getDateVal('etsgDateOperation')}
                  onChange={e => setVal('etsgDateOperation', e.target.value)}
                  onBlur={e => handleBlur('etsgDateOperation', e.target.value)}
                  disabled={dateReadOnly || savingField === 'etsgDateOperation'}
                />
              </FieldRow>
              <FieldRow label={ui('sifDataTabs.field.invoiceType')}>
                <select
                  className={inputCls}
                  value={getVal(siiTypeField)}
                  onChange={e => setVal(siiTypeField, e.target.value)}
                  onBlur={e => handleBlur(siiTypeField, e.target.value)}
                  disabled={siiFieldReadOnly || savingField === siiTypeField}
                >
                  <option value="">-</option>
                  {siiTypeOptions.map(o => (
                    <option key={o.value} value={o.value}>{o.value} - {ui(o.labelKey)}</option>
                  ))}
                </select>
              </FieldRow>
              <FieldRow label={ui('sifDataTabs.field.masterDescription')}>
                <ReadValue value={siiDescriptionMasterIdentifier} />
              </FieldRow>
              <FieldRow label={ui('sifDataTabs.field.siiDescription')}>
                <input
                  type="text"
                  className={inputCls}
                  value={getVal('aeatsiiDescripcionSii')}
                  onChange={e => setVal('aeatsiiDescripcionSii', e.target.value)}
                  onBlur={e => handleBlur('aeatsiiDescripcionSii', e.target.value)}
                  disabled={siiFieldReadOnly || savingField === 'aeatsiiDescripcionSii'}
                />
              </FieldRow>
              <FieldRow label={ui('sifDataTabs.field.exemptionCause')}>
                <ReadValue value={data?.['aeatsiiCauseExemption$_identifier']} />
              </FieldRow>
              <FieldRow label={ui('sifDataTabs.field.authorization')}>
                <div className={`${inputCls} min-h-[36px] flex items-center`}>
                  <input
                    type="checkbox"
                    checked={Boolean(getVal('aeatsiiIsauthorization'))}
                    onChange={e => !siiFieldReadOnly && handleCheckboxChange('aeatsiiIsauthorization', e.target.checked)}
                    disabled={siiFieldReadOnly || savingField === 'aeatsiiIsauthorization'}
                    className={siiFieldReadOnly ? 'cursor-default' : 'cursor-pointer'}
                  />
                </div>
              </FieldRow>
              <FieldRow label={ui('sifDataTabs.field.siiYear')}>
                <ReadValue value={data?.aeatsiiEjercicio} />
              </FieldRow>
              <FieldRow label={ui('sifDataTabs.field.siiPeriod')}>
                <ReadValue value={data?.aeatsiiPeriodo} />
              </FieldRow>
            </div>
          </>
        )}

        {effectiveTab === 'tbai' && showTbai && (
          <>
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border/40">
              <span className="text-sm font-medium text-foreground">{ui('sifDataTabs.tab.tbai')}</span>
              <TbaiBadge issent={data?.tbaiIssent} ui={ui} />
            </div>
            <div className="grid grid-cols-2 gap-x-5 gap-y-4 p-4 overflow-y-auto">
              <FieldRow label={ui('sifDataTabs.field.chainSequence')}>
                <ReadValue value={data?.tbaiSequence} />
              </FieldRow>
              <FieldRow label={ui('sifDataTabs.field.invoiceSeries')}>
                <ReadValue value={data?.tbaiInvoicenum} />
              </FieldRow>
              <FieldRow label={ui('sifDataTabs.field.invoiceSequence')}>
                <ReadValue value={data?.tbaiInvoiceseq} />
              </FieldRow>
            </div>
          </>
        )}

        {effectiveTab === 'verifactu' && showVerifactu && (
          <>
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border/40">
              <span className="text-sm font-medium text-foreground">{ui('sifDataTabs.tab.verifactu')}</span>
              <VerifactuBadge
                status={data?.etvfacInvoiceStatus}
                sent={data?.etvfacSentToVerifac}
                ui={ui}
              />
            </div>
            <div className="grid grid-cols-2 gap-x-5 gap-y-4 p-4 overflow-y-auto">
              <FieldRow label={ui('sifDataTabs.field.rfGenerationDate')}>
                <ReadValue value={data?.etvfacDateIssue} />
              </FieldRow>
              <FieldRow label={ui('sifDataTabs.field.csv')}>
                <ReadValue value={data?.cdigoCSV} />
              </FieldRow>
              <FieldRow label={ui('sifDataTabs.field.hash')}>
                <ReadValue value={data?.etvfacHash} />
              </FieldRow>
              <FieldRow label={ui('sifDataTabs.field.qrUrl')}>
                <ReadValue value={data?.etvfacQRURL} />
              </FieldRow>
              <FieldRow label={ui('sifDataTabs.field.issueDetail')}>
                <ReadValue value={data?.etvfacIssueDescription} />
              </FieldRow>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

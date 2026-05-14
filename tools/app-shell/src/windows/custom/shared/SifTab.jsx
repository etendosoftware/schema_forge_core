import { useState, useMemo } from 'react';
import { toast } from 'sonner';
import { useUI } from '@/i18n';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { DateField } from '@/components/ui/date-field';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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

function Field({ label, htmlFor, children }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor} className="text-sm text-foreground font-medium">{label}</Label>
      {children}
    </div>
  );
}

function ReadOnlyValue({ id, value }) {
  return (
    <Input
      id={id}
      type="text"
      value={value ?? '—'}
      disabled
      readOnly
      className="bg-muted/40"
    />
  );
}

function CheckboxField({ id, checked, disabled, onToggle }) {
  return (
    <div className="h-10 flex items-center">
      <button
        type="button"
        role="checkbox"
        id={id}
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onToggle(!checked)}
        className={[
          'h-5 w-5 shrink-0 rounded-sm border border-[#D1D4DB] shadow-[0px_1px_2px_rgba(18,18,23,0.05)]',
          'flex items-center justify-center transition-colors',
          'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
          'disabled:cursor-not-allowed disabled:opacity-50',
          checked ? 'bg-primary text-primary-foreground border-primary' : 'bg-transparent',
        ].join(' ')}
      >
        {checked && (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </button>
    </div>
  );
}

const PILL_CLS = {
  pending: 'bg-yellow-50 text-yellow-800',
  success: 'bg-green-50 text-green-700',
  neutral: 'bg-[#F5F7F9] text-gray-700',
  danger: 'bg-red-50 text-red-700',
};

const SII_STATUS = {
  CO: { key: 'sifDataTabs.status.sii.correct', cls: PILL_CLS.success },
  AE: { key: 'sifDataTabs.status.sii.acceptedWithErrors', cls: PILL_CLS.pending },
  IN: { key: 'sifDataTabs.status.sii.incorrect', cls: PILL_CLS.danger },
  EE: { key: 'sifDataTabs.status.sii.sendError', cls: PILL_CLS.danger },
  PE: { key: 'sifDataTabs.status.sii.pending', cls: PILL_CLS.pending },
  AN: { key: 'sifDataTabs.status.sii.cancelled', cls: PILL_CLS.neutral },
  BA: { key: 'sifDataTabs.status.sii.dropped', cls: PILL_CLS.neutral },
  NR: { key: 'sifDataTabs.status.sii.notRegistrable', cls: PILL_CLS.neutral },
};

const SII_DEFAULT = { key: 'sifDataTabs.status.sii.pending', cls: PILL_CLS.pending };

const VERIFACTU_STATUS = {
  AC: { key: 'sifDataTabs.status.verifactu.accepted', cls: PILL_CLS.success },
  AE: { key: 'sifDataTabs.status.verifactu.acceptedWithErrors', cls: PILL_CLS.pending },
  IN: { key: 'sifDataTabs.status.verifactu.invalid', cls: PILL_CLS.danger },
  ER: { key: 'sifDataTabs.status.verifactu.rejected', cls: PILL_CLS.danger },
  PE: { key: 'sifDataTabs.status.verifactu.pending', cls: PILL_CLS.pending },
};

const VERIFACTU_DEFAULT = { key: 'sifDataTabs.status.verifactu.notSent', cls: PILL_CLS.neutral };

const pillCls = (size = 'md') => {
  const base = 'inline-flex items-center font-normal rounded-full';
  return size === 'sm'
    ? `${base} text-[11px] px-2 py-0.5`
    : `${base} text-xs px-2 py-1`;
};

function SiiStatusBadge({ estado, ui, size = 'md' }) {
  const current = SII_STATUS[estado] ?? SII_DEFAULT;
  return (
    <span className={`${pillCls(size)} ${current.cls}`}>{ui(current.key)}</span>
  );
}

function TbaiBadge({ issent, ui, size = 'md' }) {
  const sent = issent === true || issent === 'Y';
  return (
    <span className={`${pillCls(size)} ${sent ? PILL_CLS.success : PILL_CLS.neutral}`}>
      {ui(sent ? 'sifDataTabs.status.tbai.sent' : 'sifDataTabs.status.tbai.notSent')}
    </span>
  );
}

function VerifactuBadge({ status, sent, ui, size = 'md' }) {
  const normalized = status || (sent === true || sent === 'Y' ? 'AC' : null);
  const current = VERIFACTU_STATUS[normalized] ?? VERIFACTU_DEFAULT;
  return (
    <span className={`${pillCls(size)} ${current.cls}`}>{ui(current.key)}</span>
  );
}

const RAIL_META = {
  sii: { labelKey: 'sifDataTabs.tab.sii', subtitleKey: 'sifDataTabs.rail.sii.subtitle' },
  tbai: { labelKey: 'sifDataTabs.tab.tbai', subtitleKey: 'sifDataTabs.rail.tbai.subtitle' },
  verifactu: { labelKey: 'sifDataTabs.tab.verifactu', subtitleKey: 'sifDataTabs.rail.verifactu.subtitle' },
};

const PANEL_META = {
  sii: { titleKey: 'sifDataTabs.panel.sii.title', subtitleKey: 'sifDataTabs.panel.sii.subtitle' },
  tbai: { titleKey: 'sifDataTabs.panel.tbai.title', subtitleKey: 'sifDataTabs.panel.tbai.subtitle' },
  verifactu: { titleKey: 'sifDataTabs.panel.verifactu.title', subtitleKey: 'sifDataTabs.panel.verifactu.subtitle' },
};

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
    showSii && { key: 'sii', ...RAIL_META.sii },
    showTbai && { key: 'tbai', ...RAIL_META.tbai },
    showVerifactu && { key: 'verifactu', ...RAIL_META.verifactu },
  ].filter(Boolean);

  return (
    <div className="flex gap-2 p-2 h-full min-h-0">
      <div className="w-56 shrink-0 flex flex-col gap-1 border border-border/40 rounded-lg bg-white p-2">
        {railItems.map(item => {
          const active = effectiveTab === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => setActiveTab(item.key)}
              className={`flex flex-col items-start gap-0.5 px-3 py-2 rounded-md cursor-pointer text-left transition-colors ${
                active ? 'bg-gray-50 border-l-2 border-primary' : 'hover:bg-gray-50/60'
              }`}
            >
              <span className={`text-xs font-semibold ${active ? 'text-primary' : 'text-foreground'}`}>
                {ui(item.labelKey)}
              </span>
              <span className="text-[11px] text-muted-foreground leading-tight">
                {ui(item.subtitleKey)}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex-1 border border-border/40 rounded-lg bg-white overflow-hidden flex flex-col min-h-0">
        {effectiveTab === 'sii' && showSii && (
          <>
            <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-border/40">
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-semibold text-foreground">{ui(PANEL_META.sii.titleKey)}</span>
                <span className="text-xs text-muted-foreground">{ui(PANEL_META.sii.subtitleKey)}</span>
              </div>
              <SiiStatusBadge estado={data?.aeatsiiEstado} ui={ui} />
            </div>
            <div className="grid grid-cols-2 gap-x-5 gap-y-4 p-4 overflow-y-auto">
              <Field label={ui('sifDataTabs.field.operationDate')} htmlFor="sif-etsgDateOperation">
                <DateField
                  id="sif-etsgDateOperation"
                  value={getDateVal('etsgDateOperation')}
                  onChange={iso => setVal('etsgDateOperation', iso)}
                  onBlur={() => handleBlur('etsgDateOperation', getDateVal('etsgDateOperation'))}
                  disabled={dateReadOnly || savingField === 'etsgDateOperation'}
                />
              </Field>
              <Field label={ui('sifDataTabs.field.invoiceType')} htmlFor="sif-siiType">
                <Select
                  value={getVal(siiTypeField) || undefined}
                  onValueChange={val => {
                    setVal(siiTypeField, val);
                    patchField(siiTypeField, val);
                  }}
                  disabled={siiFieldReadOnly || savingField === siiTypeField}
                >
                  <SelectTrigger id="sif-siiType">
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    {siiTypeOptions.map(o => (
                      <SelectItem key={o.value} value={o.value}>{o.value} — {ui(o.labelKey)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label={ui('sifDataTabs.field.masterDescription')} htmlFor="sif-masterDesc">
                <ReadOnlyValue id="sif-masterDesc" value={siiDescriptionMasterIdentifier} />
              </Field>
              <Field label={ui('sifDataTabs.field.siiDescription')} htmlFor="sif-siiDesc">
                <Input
                  id="sif-siiDesc"
                  type="text"
                  value={getVal('aeatsiiDescripcionSii')}
                  onChange={e => setVal('aeatsiiDescripcionSii', e.target.value)}
                  onBlur={e => handleBlur('aeatsiiDescripcionSii', e.target.value)}
                  disabled={siiFieldReadOnly || savingField === 'aeatsiiDescripcionSii'}
                />
              </Field>
              <Field label={ui('sifDataTabs.field.exemptionCause')} htmlFor="sif-exemption">
                <ReadOnlyValue id="sif-exemption" value={data?.['aeatsiiCauseExemption$_identifier']} />
              </Field>
              <Field label={ui('sifDataTabs.field.authorization')} htmlFor="sif-auth">
                <CheckboxField
                  id="sif-auth"
                  checked={Boolean(getVal('aeatsiiIsauthorization'))}
                  disabled={siiFieldReadOnly || savingField === 'aeatsiiIsauthorization'}
                  onToggle={val => handleCheckboxChange('aeatsiiIsauthorization', val)}
                />
              </Field>
              <Field label={ui('sifDataTabs.field.siiYear')} htmlFor="sif-siiYear">
                <ReadOnlyValue id="sif-siiYear" value={data?.aeatsiiEjercicio} />
              </Field>
              <Field label={ui('sifDataTabs.field.siiPeriod')} htmlFor="sif-siiPeriod">
                <ReadOnlyValue id="sif-siiPeriod" value={data?.aeatsiiPeriodo} />
              </Field>
            </div>
          </>
        )}

        {effectiveTab === 'tbai' && showTbai && (
          <>
            <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-border/40">
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-semibold text-foreground">{ui(PANEL_META.tbai.titleKey)}</span>
                <span className="text-xs text-muted-foreground">{ui(PANEL_META.tbai.subtitleKey)}</span>
              </div>
              <TbaiBadge issent={data?.tbaiIssent} ui={ui} />
            </div>
            <div className="grid grid-cols-2 gap-x-5 gap-y-4 p-4 overflow-y-auto">
              <Field label={ui('sifDataTabs.field.chainSequence')} htmlFor="sif-tbaiSeq">
                <ReadOnlyValue id="sif-tbaiSeq" value={data?.tbaiSequence} />
              </Field>
              <Field label={ui('sifDataTabs.field.invoiceSeries')} htmlFor="sif-tbaiSerie">
                <ReadOnlyValue id="sif-tbaiSerie" value={data?.tbaiInvoicenum} />
              </Field>
              <Field label={ui('sifDataTabs.field.invoiceSequence')} htmlFor="sif-tbaiInvSeq">
                <ReadOnlyValue id="sif-tbaiInvSeq" value={data?.tbaiInvoiceseq} />
              </Field>
            </div>
          </>
        )}

        {effectiveTab === 'verifactu' && showVerifactu && (
          <>
            <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-border/40">
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-semibold text-foreground">{ui(PANEL_META.verifactu.titleKey)}</span>
                <span className="text-xs text-muted-foreground">{ui(PANEL_META.verifactu.subtitleKey)}</span>
              </div>
              <VerifactuBadge
                status={data?.etvfacInvoiceStatus}
                sent={data?.etvfacSentToVerifac}
                ui={ui}
              />
            </div>
            <div className="grid grid-cols-2 gap-x-5 gap-y-4 p-4 overflow-y-auto">
              <Field label={ui('sifDataTabs.field.rfGenerationDate')} htmlFor="sif-vfDate">
                <ReadOnlyValue id="sif-vfDate" value={data?.etvfacDateIssue} />
              </Field>
              <Field label={ui('sifDataTabs.field.csv')} htmlFor="sif-vfCsv">
                <ReadOnlyValue id="sif-vfCsv" value={data?.cdigoCSV} />
              </Field>
              <Field label={ui('sifDataTabs.field.hash')} htmlFor="sif-vfHash">
                <ReadOnlyValue id="sif-vfHash" value={data?.etvfacHash} />
              </Field>
              <Field label={ui('sifDataTabs.field.qrUrl')} htmlFor="sif-vfQr">
                <ReadOnlyValue id="sif-vfQr" value={data?.etvfacQRURL} />
              </Field>
              <Field label={ui('sifDataTabs.field.issueDetail')} htmlFor="sif-vfIssue">
                <ReadOnlyValue id="sif-vfIssue" value={data?.etvfacIssueDescription} />
              </Field>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

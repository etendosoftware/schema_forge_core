import { useState, useMemo } from 'react';
import { toast } from 'sonner';
import { useUI } from '@/i18n';
import { useAuth } from '@/auth/AuthContext';
import { useApiFetch } from '@/auth/useApiFetch.js';
import { useFiscalConfig } from '@/windows/custom/fiscal-config/useFiscalConfig.js';
import { normalizeDateInputValue } from '@/windows/custom/fiscal-config/fiscalConfig.utils.js';
import { getInvoiceFiscalTargets } from '@/windows/custom/shared/fiscalTargets.js';

export const CLAVE_TIPO_OPTIONS = [
  { value: 'F1', labelKey: 'sifDataTabs.option.invoice' },
  { value: 'F2', labelKey: 'sifDataTabs.option.simplifiedInvoice' },
  { value: 'F4', labelKey: 'sifDataTabs.option.simplifiedInvoiceSummary' },
  { value: 'R', labelKey: 'sifDataTabs.option.correctiveInvoice' },
];

export const PURCHASE_CLAVE_TIPO_FC_OPTIONS = [
  { value: 'F6', labelKey: 'sifDataTabs.option.accountingDocument' },
  { value: 'LC', labelKey: 'sifDataTabs.option.customsComplementarySettlement' },
  { value: 'F5', labelKey: 'sifDataTabs.option.importDua' },
  { value: 'F1', labelKey: 'sifDataTabs.option.invoice' },
];

export function useSifFieldPatcher({ data, recordId, apiBaseUrl }) {
  const ui = useUI();
  const { selectedOrg } = useAuth();
  const orgId = selectedOrg?.id ?? null;
  const base = useMemo(() => (apiBaseUrl || '').replace(/\/[^/]+$/, ''), [apiBaseUrl]);
  const specName = apiBaseUrl?.split('/').filter(Boolean).pop() || 'sales-invoice';
  const apiFetch = useApiFetch(base);

  const { profile } = useFiscalConfig(orgId, apiBaseUrl);
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

  const [siiForm, setSiiForm] = useState({});
  const [savingField, setSavingField] = useState(null);

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
      const res = await apiFetch(`/${specName}/header/${recordId}`, {
        method: 'PATCH',
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

  return {
    ui,
    specName,
    isPurchaseInvoice,
    siiTypeField,
    siiDescriptionMasterIdentifier,
    siiTypeOptions,
    showSii,
    showTbai,
    showVerifactu,
    isDraft,
    isSentToSii,
    dateReadOnly,
    siiFieldReadOnly,
    savingField,
    getVal,
    getDateVal,
    setVal,
    patchField,
    handleBlur,
    handleCheckboxChange,
  };
}

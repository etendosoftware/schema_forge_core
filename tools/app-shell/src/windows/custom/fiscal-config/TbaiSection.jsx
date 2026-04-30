import { useState, forwardRef, useImperativeHandle } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useUI } from '@/i18n';
import { neoBase } from '@/components/related-documents/helpers.js';
import CertSection from './CertSection.jsx';
import {
  getFiscalRecordId,
  isEtendoTrue,
  normalizeDateInputValue,
  normalizeEtendoBoolean,
  serializeBooleanFields,
} from './fiscalConfig.utils.js';

// Confirmed from artifacts/tbai-config/contract.json → backendContract.window.primaryEntity
const TBAI_ENTITY = 'header';

async function putTbai(base, id, body, token) {
  const res = await fetch(`${base}/tbai-config/${TBAI_ENTITY}/${id}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text().catch(() => res.statusText));
}

const TbaiSection = forwardRef(function TbaiSection({ record, token, apiBaseUrl, orgId, onSave, hideSave, hideCert }, ref) {
  const ui = useUI();
  const [form, setForm] = useState({
    tbaisystemdate:         normalizeDateInputValue(record?.tbaisystemdate),
    productionEnv:          normalizeEtendoBoolean(record?.productionEnv),
    invoiceDescription:     record?.invoiceDescription     ?? '',
    uSEAsproductDesc:       normalizeEtendoBoolean(record?.uSEAsproductDesc),
    autoSendInvoices:       normalizeEtendoBoolean(record?.autoSendInvoices),
    jasperreportPath:       record?.jasperreportPath       ?? '',
    validatePreviousInvoice:normalizeEtendoBoolean(record?.validatePreviousInvoice),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState(null);

  function set(field, value) { setForm(f => ({ ...f, [field]: value })); }

  function validate() {
    if (!form.tbaisystemdate) return ui('fiscal.tbai.err.enrollDate');
    if (!form.invoiceDescription) return ui('fiscal.tbai.err.invoiceDesc');
    return null;
  }

  async function save() {
    const validationError = validate();
    if (validationError) { setError(validationError); throw new Error(validationError); }
    const recordId = getFiscalRecordId(record, 'TBAI');
    if (!recordId) {
      const idError = ui('fiscal.tbai.err.noRecordId');
      setError(idError);
      throw new Error(idError);
    }
    setSaving(true);
    setError(null);
    try {
      await putTbai(
        neoBase(apiBaseUrl),
        recordId,
        serializeBooleanFields(form, ['productionEnv', 'uSEAsproductDesc', 'autoSendInvoices', 'validatePreviousInvoice']),
        token,
      );
      onSave();
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setSaving(false);
    }
  }

  useImperativeHandle(ref, () => ({ save }));

  const yesno = (field) => (
    <Switch checked={isEtendoTrue(form[field])} onCheckedChange={v => set(field, v ? 'Y' : 'N')} />
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h3 className="text-base font-semibold">TBAI</h3>
        {record?.etsgSifTerritory && (
          <Badge variant="outline">{record.etsgSifTerritory}</Badge>
        )}
      </div>

      <div className="space-y-1">
        <Label>{ui('fiscal.tbai.field.enrollDate')}</Label>
        <Input type="date" value={form.tbaisystemdate} onChange={e => set('tbaisystemdate', e.target.value)} />
      </div>

      <fieldset className="space-y-4 border-0 p-0 m-0">
        <legend className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">{ui('fiscal.tbai.legend.env')}</legend>
        <div className="flex items-center justify-between">
          <Label>{ui('fiscal.tbai.field.production')}</Label>
          {yesno('productionEnv')}
        </div>
      </fieldset>

      <fieldset className="space-y-4 border-0 p-0 m-0">
        <legend className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">{ui('fiscal.tbai.legend.billing')}</legend>
        <div className="space-y-1">
          <Label>{ui('fiscal.tbai.field.invoiceDesc')}</Label>
          <Input value={form.invoiceDescription} onChange={e => set('invoiceDescription', e.target.value)} />
        </div>
        <div className="flex items-center justify-between">
          <Label>{ui('fiscal.tbai.field.useAsProduct')}</Label>
          {yesno('uSEAsproductDesc')}
        </div>
        <div className="flex items-center justify-between">
          <Label>{ui('fiscal.tbai.field.autoSend')}</Label>
          {yesno('autoSendInvoices')}
        </div>
      </fieldset>

      <fieldset className="space-y-4 border-0 p-0 m-0">
        <legend className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">{ui('fiscal.tbai.legend.technical')}</legend>
        <div className="space-y-1">
          <Label>{ui('fiscal.tbai.field.jasper')}</Label>
          <Input value={form.jasperreportPath} onChange={e => set('jasperreportPath', e.target.value)} placeholder={ui('fiscal.tbai.field.jasper.placeholder')} />
        </div>
        <div className="flex items-center justify-between">
          <Label>{ui('fiscal.tbai.field.validatePrev')}</Label>
          {yesno('validatePreviousInvoice')}
        </div>
      </fieldset>

      {!hideCert && <CertSection context="tbai" orgId={orgId} token={token} apiBaseUrl={apiBaseUrl} />}

      {error && <p className="text-sm text-destructive">{error}</p>}
      {!hideSave && (
        <Button onClick={save} disabled={saving}>
          {saving ? ui('fiscal.saving') : ui('fiscal.save')}
        </Button>
      )}
    </div>
  );
});

export default TbaiSection;

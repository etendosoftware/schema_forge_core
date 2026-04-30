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
  buildVerifactuUpdatePayload,
  getFiscalRecordId,
  getVerifactuTaxTypeLabel,
  isEtendoTrue,
  normalizeEtendoBoolean,
  normalizeVerifactuTaxType,
  VERIFACTU_TAX_TYPE_OPTIONS,
} from './fiscalConfig.utils.js';

// Confirmed from artifacts/verifactu-config/contract.json → backendContract.window.primaryEntity
const VERIFACTU_ENTITY = 'cabeceraDeConfiguraciónVerifactu';

async function putVerifactu(base, id, body, token) {
  const res = await fetch(`${base}/verifactu-config/${VERIFACTU_ENTITY}/${id}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text().catch(() => res.statusText));
}

const VerifactuSection = forwardRef(function VerifactuSection({ record, token, apiBaseUrl, orgId, onSave, hideSave }, ref) {
  const ui = useUI();
  const isLocked = isEtendoTrue(record?.isReady);

  const [form, setForm] = useState({
    tAXType:        normalizeVerifactuTaxType(record?.tAXType) ?? '',
    defaultQR:      normalizeEtendoBoolean(record?.defaultQR),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  function set(field, value) {
    if (isLocked) return;
    setForm(f => ({ ...f, [field]: value }));
  }

  async function handleSave() {
    const recordId = getFiscalRecordId(record, 'VERIFACTU');
    if (!recordId) {
      const idError = ui('fiscal.verifactu.err.noRecordId');
      setError(idError);
      throw new Error(idError);
    }
    setSaving(true);
    setError(null);
    try {
      await putVerifactu(neoBase(apiBaseUrl), recordId, buildVerifactuUpdatePayload(form), token);
      onSave();
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setSaving(false);
    }
  }

  useImperativeHandle(ref, () => ({ save: handleSave }));

  const yesno = (field) => (
    <Switch
      checked={isEtendoTrue(form[field])}
      onCheckedChange={v => set(field, v ? 'Y' : 'N')}
      disabled={isLocked}
    />
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h3 className="text-base font-semibold">Verifactu</h3>
        <Badge variant={isLocked ? 'default' : 'outline'}>
          {isLocked ? ui('fiscal.verifactu.locked.badge') : ui('fiscal.verifactu.unlocked.badge')}
        </Badge>
      </div>

      <div className="space-y-1">
        <Label>{ui('fiscal.verifactu.field.tax')}</Label>
        {isLocked ? (
          <Input value={getVerifactuTaxTypeLabel(form.tAXType)} disabled />
        ) : (
          <select
            value={form.tAXType}
            onChange={e => set('tAXType', e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
          >
            <option value="">{ui('fiscal.verifactu.field.selectTax')}</option>
            {VERIFACTU_TAX_TYPE_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        )}
      </div>
      <div className="flex items-center justify-between">
        <Label>{ui('fiscal.verifactu.field.qr')}</Label>
        {yesno('defaultQR')}
      </div>
      <div className="space-y-1">
        <Label>{ui('fiscal.verifactu.field.nif')}</Label>
        <Input value={record?.issuerNIF ?? ''} disabled />
      </div>
      <div className="space-y-1">
        <Label>{ui('fiscal.verifactu.field.systemStart')}</Label>
        <Input value={record?.systemStartat ?? ''} disabled />
      </div>
      <div className="space-y-1">
        <Label>{ui('fiscal.verifactu.field.systemStop')}</Label>
        <Input value={record?.systemStopat ?? ''} disabled />
      </div>
      <div className="space-y-1">
        <Label>{ui('fiscal.verifactu.field.incident')}</Label>
        <Input value={record?.incidentReport ?? ''} disabled />
      </div>
      <div className="space-y-1">
        <Label>{ui('fiscal.verifactu.field.enrollDate')}</Label>
        <Input value={record?.inVfactuSystem ?? ''} disabled />
      </div>

      <CertSection context="verifactu" orgId={orgId} token={token} apiBaseUrl={apiBaseUrl} />

      {error && <p className="text-sm text-destructive">{error}</p>}

      {!hideSave && !isLocked && (
        <Button onClick={handleSave} disabled={saving}>
          {saving ? ui('fiscal.verifactu.saving') : ui('fiscal.save')}
        </Button>
      )}
    </div>
  );
});

export default VerifactuSection;

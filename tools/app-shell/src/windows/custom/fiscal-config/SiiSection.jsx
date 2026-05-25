import { useState, forwardRef, useImperativeHandle } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DateField } from '@/components/ui/date-field';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useUI } from '@schema-forge/app-shell-core';
import { neoBase } from '@/components/related-documents/helpers.js';
import { useApiFetch } from '@schema-forge/app-shell-core';
import CertSection from './CertSection.jsx';
import { getFiscalRecordId, isEtendoTrue, mapSiiRecordToForm, serializeBooleanFields } from './fiscalConfig.utils.js';

const SII_ENTITY = 'siiConfiguration';

const SiiSection = forwardRef(function SiiSection({ record, apiBaseUrl, orgId, onSave, variant, hideSave, hideCert }, ref) {
  const ui = useUI();
  const apiFetch = useApiFetch(neoBase(apiBaseUrl));
  const [form, setForm] = useState(mapSiiRecordToForm(record));
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState(null);

  function set(field, value) { setForm(f => ({ ...f, [field]: value })); }

  function validate() {
    if (!form.plazoLmiteDeEnvoASII) return ui('fiscal.sii.err.deadline');
    return null;
  }

  async function save() {
    const validationError = validate();
    if (validationError) { setError(validationError); throw new Error(validationError); }
    const recordId = getFiscalRecordId(record, 'SII');
    if (!recordId) {
      const idError = ui('fiscal.sii.err.noRecordId');
      setError(idError);
      throw new Error(idError);
    }
    setSaving(true);
    setError(null);
    try {
      const res = await apiFetch(`/sii-config/${SII_ENTITY}/${recordId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(serializeBooleanFields(form, ['acogidaAlSII', 'entornoDeProduccin', 'adjuntarArchivosXML', 'postedInvoices', 'recc', 'redeme'])),
      });
      if (!res.ok) throw new Error(await res.text().catch(() => res.statusText));
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
    <Switch
      checked={isEtendoTrue(form[field])}
      onCheckedChange={v => set(field, v ? 'Y' : 'N')}
    />
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h3 className="text-base font-semibold">SII</h3>
        {variant === 'sii-navarra' && (
          <Badge variant="secondary">{ui('fiscal.sii.badge.navarra')}</Badge>
        )}
      </div>

      <fieldset className="space-y-4 border-0 p-0 m-0">
        <legend className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">{ui('fiscal.sii.legend.status')}</legend>
        <div className="flex items-center justify-between">
          <Label>{ui('fiscal.sii.field.enrolled')}</Label>
          {yesno('acogidaAlSII')}
        </div>
        <div className="space-y-1">
          <Label>{ui('fiscal.sii.field.enrollDate')}</Label>
          <DateField value={form.fechaAcogidaSII} onChange={(iso) => set('fechaAcogidaSII', iso)} />
        </div>
        <div className="space-y-1">
          <Label>{ui('fiscal.sii.field.monitorDate')}</Label>
          <DateField value={form.monitordate} onChange={(iso) => set('monitordate', iso)} />
        </div>
      </fieldset>

      <fieldset className="space-y-4 border-0 p-0 m-0">
        <legend className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">{ui('fiscal.sii.legend.env')}</legend>
        <div className="flex items-center justify-between">
          <Label>{ui('fiscal.sii.field.production')}</Label>
          {yesno('entornoDeProduccin')}
        </div>
        <div className="flex items-center justify-between">
          <Label>{ui('fiscal.sii.field.attachXml')}</Label>
          {yesno('adjuntarArchivosXML')}
        </div>
      </fieldset>

      <fieldset className="space-y-4 border-0 p-0 m-0">
        <legend className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">{ui('fiscal.sii.legend.sends')}</legend>
        <div className="space-y-1">
          <Label>{ui('fiscal.sii.field.deadline')}</Label>
          <Input type="number" min={0} value={form.plazoLmiteDeEnvoASII} onChange={e => set('plazoLmiteDeEnvoASII', e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>{ui('fiscal.sii.field.cadenceSale')}</Label>
          <Input type="number" min={0} value={form.cadenciaEnvoFacturasVentaASII} onChange={e => set('cadenciaEnvoFacturasVentaASII', e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>{ui('fiscal.sii.field.cadencePurchase')}</Label>
          <Input type="number" min={0} value={form.cadenciaEnvoFacturasCompraASII} onChange={e => set('cadenciaEnvoFacturasCompraASII', e.target.value)} />
        </div>
        <div className="flex items-center justify-between">
          <Label>{ui('fiscal.sii.field.postedOnly')}</Label>
          {yesno('postedInvoices')}
        </div>
      </fieldset>

      <fieldset className="space-y-4 border-0 p-0 m-0">
        <legend className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">{ui('fiscal.sii.legend.special')}</legend>
        <div className="flex items-center justify-between">
          <Label>{ui('fiscal.sii.field.recc')}</Label>
          {yesno('recc')}
        </div>
        <div className="flex items-center justify-between">
          <Label>{ui('fiscal.sii.field.redeme')}</Label>
          {yesno('redeme')}
        </div>
        <div className="space-y-1">
          <Label>{ui('fiscal.sii.field.authno')}</Label>
          <Input value={form.authorizationno} onChange={e => set('authorizationno', e.target.value)} />
        </div>
      </fieldset>

      {!hideCert && <CertSection context="sii" orgId={orgId} apiBaseUrl={apiBaseUrl} />}

      <fieldset className="space-y-4 border-0 p-0 m-0">
        <legend className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">{ui('fiscal.sii.legend.actions')}</legend>
        <Button
          variant="outline"
          type="button"
          onClick={async () => {
            try {
              const recordId = getFiscalRecordId(record, 'SII');
              if (!recordId) throw new Error(ui('fiscal.sii.err.noRecordId'));
              const res = await apiFetch(`/sii-config/${SII_ENTITY}/${recordId}/action/validHash`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
              });
              if (!res.ok) throw new Error(await res.text().catch(() => res.statusText));
              onSave();
            } catch (err) {
              setError(err.message);
            }
          }}
        >
          {ui('fiscal.sii.action.validateHash')}
        </Button>
      </fieldset>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {!hideSave && (
        <Button onClick={save} disabled={saving}>
          {saving ? ui('fiscal.saving') : ui('fiscal.save')}
        </Button>
      )}
    </div>
  );
});

export default SiiSection;

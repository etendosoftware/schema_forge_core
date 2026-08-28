import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';

// Exercises the REAL shared module. This logic lived inline in the dev plugin
// (never importable) with an independent, already-drifted copy in
// server.js. Never re-implement it here — a hand-rolled copy passes whether
// or not the shipped code resolves options labels correctly.
import { filterAndTransformParams } from '../src/report-filters.js';

const baseContract = {
  parameters: [
    { name: 'dateFrom', type: 'date', label: { en_US: 'From Date', es_ES: 'Desde Fecha' } },
    {
      name: 'accountLevel',
      label: { en_US: 'Account Level', es_ES: 'Nivel de Cuenta' },
      options: [
        { value: 'S', label: { en_US: 'Subaccount', es_ES: 'Subcuenta' } },
        { value: 'C', label: { en_US: 'Account', es_ES: 'Cuenta' } },
      ],
    },
    { name: 'bPartnerId', label: { en_US: 'Contact', es_ES: 'Contacto' } },
    { name: 'groupBy' },
    { name: 'dim', groupByValue: 'warehouse', groupByField: 'wh', label: { en_US: 'Warehouse', es_ES: 'Almacén' } },
    { name: 'showTotals', type: 'toggle', label: { en_US: 'Show Totals', es_ES: 'Mostrar Totales' } },
    { name: 'orgId', hidden: true, autoDefault: true, label: { en_US: 'Organization', es_ES: 'Organización' } },
    { name: 'acctSchemaId', hidden: true, autoDefault: true, label: { en_US: 'General Ledger', es_ES: 'Libro Mayor' } },
    { name: 'internalToggle', hidden: true, type: 'toggle', label: { en_US: 'Internal', es_ES: 'Interno' } },
  ],
};

describe('filterAndTransformParams', () => {
  it('drops hidden params (auto-resolved session context, ETP-5013) except orgId', () => {
    // acctSchemaId is never a control in the sidebar — it's resolved silently
    // from the session. Showing it reads as "the user chose this ledger" when
    // they never touched it. orgId is the deliberate exception (ETP-5013
    // follow-up): the report is always scoped to an org, and that scope must
    // always be visible in the summary, using its real display name.
    const out = filterAndTransformParams(
      { orgId: 'org-1', _display_orgId: 'GOOrg', acctSchemaId: 'sch-1', _display_acctSchemaId: 'Esquema GO' },
      baseContract, 'es_ES');
    assert.deepEqual(out, [{ label: 'Organización', value: 'GOOrg' }]);
  });

  it('shows orgId with the raw UUID when no _display_orgId was supplied', () => {
    const out = filterAndTransformParams({ orgId: 'org-1' }, baseContract, 'es_ES');
    assert.deepEqual(out, [{ label: 'Organización', value: 'org-1' }]);
  });

  it('still drops other hidden params like acctSchemaId when orgId is absent', () => {
    const out = filterAndTransformParams(
      { acctSchemaId: 'sch-1', _display_acctSchemaId: 'Esquema GO' }, baseContract, 'es_ES');
    assert.deepEqual(out, []);
  });

  it('drops a hidden param even when it is a truthy toggle', () => {
    const out = filterAndTransformParams({ internalToggle: true }, baseContract, 'es_ES');
    assert.deepEqual(out, []);
  });

  it('keeps other hidden params out while showing orgId and visible ones from the same request', () => {
    const out = filterAndTransformParams(
      { orgId: 'org-1', acctSchemaId: 'sch-1', accountLevel: 'S' }, baseContract, 'es_ES');
    assert.deepEqual(out, [
      { label: 'Organización', value: 'org-1' },
      { label: 'Nivel de Cuenta', value: 'Subcuenta' },
    ]);
  });

  it('still shows a param with no matching definition at all (not hidden by omission)', () => {
    const out = filterAndTransformParams({ someAdHocParam: 'X' }, baseContract, 'es_ES');
    assert.deepEqual(out, [{ label: 'someAdHocParam', value: 'X' }]);
  });

  it('resolves a boolean toggle to a localized Yes/No, not the raw JS value', () => {
    const out = filterAndTransformParams({ showTotals: true }, baseContract, 'es_ES');
    assert.deepEqual(out, [{ label: 'Mostrar Totales', value: 'Sí' }]);
  });

  it('resolves the toggle in en_US too', () => {
    const out = filterAndTransformParams({ showTotals: true }, baseContract);
    assert.deepEqual(out, [{ label: 'Show Totals', value: 'Yes' }]);
  });

  it('an "on" toggle sent as the STRING "true" still resolves', () => {
    const out = filterAndTransformParams({ showTotals: 'true' }, baseContract, 'es_ES');
    assert.equal(out[0].value, 'Sí');
  });

  it('a false toggle (its "off" default) is dropped entirely, not shown as "No"', () => {
    // Matches every other unfilled/default-off param — the grid only shows what's
    // actually in effect, and "off" is the silent default, not an active filter.
    const out = filterAndTransformParams({ showTotals: false }, baseContract, 'es_ES');
    assert.deepEqual(out, []);
  });

  it('drops empty, undefined and _display_-prefixed keys', () => {
    const out = filterAndTransformParams(
      { dateFrom: '', bPartnerId: undefined, _display_bPartnerId: 'Juan Perez' }, baseContract);
    assert.deepEqual(out, []);
  });

  it('resolves a select option code to its human label (the bug this module fixes)', () => {
    // server.js's original copy lacked this branch entirely, so a report using
    // any plain `options` select (Balance Sheet/Profit & Loss/Trial Balance's
    // accountLevel) showed the raw stored code server-side instead of the label.
    const out = filterAndTransformParams({ accountLevel: 'S' }, baseContract, 'es_ES');
    assert.deepEqual(out, [{ label: 'Nivel de Cuenta', value: 'Subcuenta' }]);
  });

  it('falls back to the raw value when the code matches no declared option', () => {
    const out = filterAndTransformParams({ accountLevel: 'Z' }, baseContract, 'es_ES');
    assert.equal(out[0].value, 'Z');
  });

  it('resolves groupBy VALUE to its dimension parameter label', () => {
    // The chip's label comes from the "groupBy" param definition itself (here it
    // has none, so it falls back to the raw key "groupBy"); only the VALUE is
    // resolved through the matching dimension param's own label.
    const out = filterAndTransformParams({ groupBy: 'warehouse' }, baseContract, 'es_ES');
    assert.deepEqual(out, [{ label: 'groupBy', value: 'Almacén' }]);
  });

  it('prefers the _display_ shadow value over the raw id (search selectors)', () => {
    const out = filterAndTransformParams(
      { bPartnerId: '9F2A...', _display_bPartnerId: 'Juan Perez' }, baseContract, 'es_ES');
    assert.deepEqual(out, [{ label: 'Contacto', value: 'Juan Perez' }]);
  });

  it('collapses a pipe-joined multi-select display value into a comma list', () => {
    const out = filterAndTransformParams(
      { bPartnerId: 'a,b', _display_bPartnerId: 'Juan Perez | Laura Morat' }, baseContract, 'es_ES');
    assert.equal(out[0].value, 'Juan Perez, Laura Morat');
  });

  it('formats an ISO date param as DD/MM/YYYY', () => {
    const out = filterAndTransformParams({ dateFrom: '2026-08-25' }, baseContract, 'es_ES');
    assert.deepEqual(out, [{ label: 'Desde Fecha', value: '25/08/2026' }]);
  });

  it('leaves a non-ISO date value untouched (already a display string)', () => {
    const out = filterAndTransformParams({ dateFrom: '25/08/2026' }, baseContract, 'es_ES');
    assert.equal(out[0].value, '25/08/2026');
  });

  it('falls back to the param name when it has no label', () => {
    const out = filterAndTransformParams({ unknownParam: 'X' }, baseContract, 'es_ES');
    assert.deepEqual(out, [{ label: 'unknownParam', value: 'X' }]);
  });

  it('defaults to en_US when no locale is given', () => {
    const out = filterAndTransformParams({ accountLevel: 'C' }, baseContract);
    assert.deepEqual(out, [{ label: 'Account Level', value: 'Account' }]);
  });
});

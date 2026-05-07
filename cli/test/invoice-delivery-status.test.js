import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Integrity test for the em_etgo_delivery_status virtual column wiring on
// invoice grids. Locks down:
//   1. decisions.json declares the field (visibility + grid + gridOrder).
//   2. labelOverrides translate the column for both locales.
//   3. contract.json reflects the field on the header entity.
//
// If someone moves visibility to "system", drops the gridOrder, removes the
// labelOverrides, or reverts the regen, this test fails — protecting the
// surface that the user-facing column "Estado de entrega" depends on.

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');

function loadJson(...parts) {
  return JSON.parse(readFileSync(join(ROOT, ...parts), 'utf8'));
}

const SCOPES = [
  { tag: 'sales-invoice',    artifactDir: 'sales-invoice'    },
  { tag: 'purchase-invoice', artifactDir: 'purchase-invoice' },
];

for (const { tag, artifactDir } of SCOPES) {
  describe(`${tag} — em_etgo_delivery_status configuration`, () => {
    const decisions = loadJson('artifacts', artifactDir, 'decisions.json');
    const contract  = loadJson('artifacts', artifactDir, 'contract.json');

    it('decisions.json registers eTGODeliveryStatus on the header entity', () => {
      const cfg = decisions.entities?.header?.fields?.eTGODeliveryStatus;
      assert.ok(cfg, 'expected entities.header.fields.eTGODeliveryStatus');
      assert.equal(cfg.visibility, 'readOnly');
      assert.equal(cfg.grid, true);
      assert.equal(cfg.gridOrder, 8);
      assert.equal(cfg.form, false);
    });

    it('decisions.json translates em_etgo_delivery_status in both locales', () => {
      const overrides = decisions.window?.labelOverrides;
      assert.ok(overrides, 'expected window.labelOverrides');
      assert.equal(overrides.es_ES?.em_etgo_delivery_status, 'Estado de entrega');
      assert.equal(overrides.en_US?.em_etgo_delivery_status, 'Delivery Status');
    });

    it('contract.json exposes the field on the header entity', () => {
      const header = contract.frontendContract?.entities?.header;
      assert.ok(header, 'expected frontendContract.entities.header');
      const field = header.fields?.find(f => f.apiKey === 'eTGODeliveryStatus');
      assert.ok(field, 'expected header.fields entry for apiKey "eTGODeliveryStatus"');
      assert.equal(field.column, 'em_etgo_delivery_status');
      assert.equal(field.grid, true);
      assert.equal(field.gridOrder, 8);
    });

    it('contract.json carries the labelOverrides forward', () => {
      const overrides = contract.frontendContract?.window?.labelOverrides;
      assert.ok(overrides, 'expected frontendContract.window.labelOverrides');
      assert.equal(overrides.es_ES?.em_etgo_delivery_status, 'Estado de entrega');
      assert.equal(overrides.en_US?.em_etgo_delivery_status, 'Delivery Status');
    });
  });
}

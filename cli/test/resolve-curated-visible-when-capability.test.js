import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { resolveCurated } from '../src/resolve-curated.js';

// ETP-4520 — `visibleWhenCapability` field decision: names a capability key
// (e.g. "showAccountingFields") gating the field's visibility on the
// grid/statusPill surfaces at runtime. Opt-in copy-through, like `badge`.
describe('resolveCurated — visibleWhenCapability', () => {
  function buildSchemaRaw() {
    return {
      window: { id: '181', name: 'Purchase Order' },
      entities: [{
        name: 'header',
        tableName: 'C_Order',
        fields: [
          { name: 'documentNo', columnName: 'DocumentNo', label: 'Document No', type: 'string', visibility: 'editable' },
          { name: 'accountingDate', columnName: 'AccountingDate', label: 'Accounting Date', type: 'date', visibility: 'editable' },
        ],
      }],
    };
  }

  it('copies visibleWhenCapability through onto the curated field when declared', async () => {
    const decisions = {
      entities: {
        header: {
          fields: {
            accountingDate: { visibleWhenCapability: 'showAccountingFields' },
          },
        },
      },
    };
    const { schema } = await resolveCurated(buildSchemaRaw(), { rules: [] }, decisions);
    const field = schema.entities[0].fields.find(f => f.name === 'accountingDate');
    assert.equal(field.visibleWhenCapability, 'showAccountingFields');
  });

  it('omits visibleWhenCapability entirely when not declared (opt-in, no behavior change)', async () => {
    const { schema } = await resolveCurated(buildSchemaRaw(), { rules: [] }, {});
    const field = schema.entities[0].fields.find(f => f.name === 'accountingDate');
    assert.equal(field.visibleWhenCapability, undefined);
  });
});

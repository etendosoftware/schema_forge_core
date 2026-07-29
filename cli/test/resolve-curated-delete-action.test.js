// ETP-4708 — `window.deleteAction` must survive the resolver so it reaches the
// contract and, from there, the generator.
//
// This test exists because the chain broke silently once. `customComponents` is
// copied through wholesale, so `deleteConfirmModal` / `deleteConfirmModalProps`
// arrived in the contract with no resolver change at all — but a NEW window-level
// scalar needs an explicit entry in WINDOW_TRUTHY_PROPS. Without it the generator
// read `windowConfig.deleteAction === undefined`, emitted nothing, and every other
// check still passed: decisions.json had the key, the generator had the code, and
// the prop simply never appeared. Exactly the "broken chain" failure CLAUDE.md
// warns about, and only visible by asserting the resolver's own output.
//
// Truthy-only per R3: absent or null contributes nothing, so windows that do not
// declare it produce byte-identical contracts.

import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { resolveCurated } from '../src/resolve-curated.js';

function buildSchemaRaw() {
  return {
    window: { id: '181', name: 'Payment In' },
    entities: [{
      name: 'header',
      tableName: 'FIN_Payment',
      fields: [
        { name: 'documentNo', columnName: 'DocumentNo', label: 'Document No', type: 'string', visibility: 'editable' },
      ],
    }],
  };
}

describe('resolveCurated — window.deleteAction', () => {
  it('copies deleteAction through to the curated window when declared', async () => {
    const { schema } = await resolveCurated(buildSchemaRaw(), { rules: [] }, {
      window: { deleteAction: 'eTPRRemovePayment' },
    });
    assert.equal(schema.window.deleteAction, 'eTPRRemovePayment');
  });

  it('omits deleteAction entirely when not declared (R3 default)', async () => {
    const { schema } = await resolveCurated(buildSchemaRaw(), { rules: [] }, {});
    assert.equal(schema.window.deleteAction, undefined);
  });

  it('omits deleteAction for an explicitly null declaration', async () => {
    const { schema } = await resolveCurated(buildSchemaRaw(), { rules: [] }, {
      window: { deleteAction: null },
    });
    assert.equal(schema.window.deleteAction, undefined);
  });

  it('does not disturb the sibling delete flags', async () => {
    const { schema } = await resolveCurated(buildSchemaRaw(), { rules: [] }, {
      window: { deleteAction: 'eTPRRemovePayment', hideDeleteWhenComplete: true },
    });
    assert.equal(schema.window.deleteAction, 'eTPRRemovePayment');
    assert.equal(schema.window.hideDeleteWhenComplete, true);
  });
});

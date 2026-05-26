/**
 * Regression guard: ETP-4011 — Reactivate action removed from Purchase Order.
 *
 * Reads `tools/app-shell/src/windows/custom/purchase-order/index.jsx` as source
 * and asserts that:
 *   1. PurchaseOrderReactivateBulkAction is NOT imported (deleted wrapper).
 *   2. buildInOutActions IS imported from BulkDocumentAction.
 *   3. buildActions={buildInOutActions} is wired to BulkDocumentAction.
 *   4. The 'reactivate' key is NOT present in the menuActions return array.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Navigate from artifacts/purchase-order/custom/__tests__/ up to repo root,
// then into the custom window source.
const SRC_PATH = join(
  __dirname,
  '../../../../tools/app-shell/src/windows/custom/purchase-order/index.jsx',
);
const src = readFileSync(SRC_PATH, 'utf8');

describe('PurchaseOrderWindow — no Reactivate action (ETP-4011)', () => {
  it('does NOT import PurchaseOrderReactivateBulkAction', () => {
    assert.doesNotMatch(
      src,
      /PurchaseOrderReactivateBulkAction/,
      'PurchaseOrderReactivateBulkAction must not be imported — it was deleted in ETP-4011',
    );
  });

  it('imports buildInOutActions from BulkDocumentAction', () => {
    assert.match(
      src,
      /import\s+BulkDocumentAction\s*,\s*\{\s*buildInOutActions\s*\}\s+from\s+'@\/components\/contract-ui\/BulkDocumentAction'/,
      'buildInOutActions must be imported alongside BulkDocumentAction',
    );
  });

  it('wires buildActions={buildInOutActions} to BulkDocumentAction', () => {
    assert.match(
      src,
      /buildActions=\{buildInOutActions\}/,
      'BulkDocumentAction must receive buildInOutActions via the buildActions prop',
    );
  });

  it('does NOT declare a reactivate key in the menuActions return', () => {
    assert.doesNotMatch(
      src,
      /key:\s*['"]reactivate['"]/,
      "menuActions must not contain a 'reactivate' key entry",
    );
  });
});

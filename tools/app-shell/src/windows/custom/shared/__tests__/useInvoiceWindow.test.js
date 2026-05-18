import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { INVOICE_DRAFT_MODE, buildInvoiceRowQuickActions } from '../useInvoiceWindow.js';

const src = readFileSync(new URL('../useInvoiceWindow.js', import.meta.url), 'utf8');

describe('useInvoiceWindow', () => {
  describe('INVOICE_DRAFT_MODE', () => {
    it('is enabled', () => {
      assert.equal(INVOICE_DRAFT_MODE.enabled, true);
    });

    it('uses documentAction as processField', () => {
      assert.equal(INVOICE_DRAFT_MODE.processField, 'documentAction');
    });

    it('uses CO as processValue', () => {
      assert.equal(INVOICE_DRAFT_MODE.processValue, 'CO');
    });

    it('disables when the document has no lines', () => {
      assert.equal(INVOICE_DRAFT_MODE.disableWhenEmpty, true);
    });
  });

  describe('buildInvoiceRowQuickActions', () => {
    it('returns all four actions enabled', () => {
      const result = buildInvoiceRowQuickActions(() => {}, 'test', () => {}, () => {}, () => {});
      assert.equal(result.actions.edit.show, true);
      assert.equal(result.actions.duplicate.show, true);
      assert.equal(result.actions.email.show, true);
      assert.equal(result.actions.delete.show, true);
    });

    it('sets editMode to navigate and enables documentPreview', () => {
      const result = buildInvoiceRowQuickActions(() => {}, 'test', () => {}, () => {}, () => {});
      assert.equal(result.editMode, 'navigate');
      assert.equal(result.documentPreview, true);
    });

    it('onEdit navigates to the correct window path', () => {
      const calls = [];
      const navigate = (path) => calls.push(path);
      const result = buildInvoiceRowQuickActions(navigate, 'purchase-invoice', () => {}, () => {}, () => {});
      result.onEdit({ id: '42' });
      assert.equal(calls[0], '/purchase-invoice/42');
    });

    it('onClone wraps a single row in an array', () => {
      const captured = [];
      const setCloneTargets = (v) => captured.push(v);
      const result = buildInvoiceRowQuickActions(() => {}, 'x', setCloneTargets, () => {}, () => {});
      result.onClone({ id: 'r1' });
      assert.deepEqual(captured[0], [{ id: 'r1' }]);
    });

    it('onEmail forwards the row to setEmailRow', () => {
      const captured = [];
      const setEmailRow = (row) => captured.push(row);
      const result = buildInvoiceRowQuickActions(() => {}, 'x', () => {}, setEmailRow, () => {});
      result.onEmail({ id: 'r2' });
      assert.deepEqual(captured[0], { id: 'r2' });
    });

    it('onDelete is the requestDelete function itself', () => {
      const requestDelete = () => {};
      const result = buildInvoiceRowQuickActions(() => {}, 'x', () => {}, () => {}, requestDelete);
      assert.equal(result.onDelete, requestDelete);
    });
  });

  describe('useClearSavedRecord (source shape)', () => {
    it('is exported as a named hook', () => {
      assert.match(src, /export function useClearSavedRecord/);
    });

    it('calls setSavedRecord(null) to reset state', () => {
      assert.match(src, /setSavedRecord\(null\)/);
    });

    it('navigates with replace:true to clear the browser history state', () => {
      assert.match(src, /location\.state\?\.savedRecord/);
      assert.match(src, /replace: true/);
    });
  });
});

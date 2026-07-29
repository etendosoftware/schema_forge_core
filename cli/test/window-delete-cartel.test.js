// Tests that a window can DECLARE its delete behaviour instead of the generic
// DetailView hardcoding it per window name.
//
// This is the generator half of ETP-4708 / L4-adjacent in the contract-ui churn
// report: DetailView.jsx carries two window-keyed maps (WINDOW_DELETE_ACTIONS and
// WINDOW_DELETE_CONFIRM_MODALS), both hardcoded to payment-in/payment-out. The
// window now declares:
//   - window.deleteAction                            → NEO action for the trash button
//   - window.customComponents.deleteConfirmModal     → rich cartel replacing the Dialog
//   - window.customComponents.deleteConfirmModalProps→ that modal's own config ({ dir })
//
// R3 (sparse decisions) is what the control cases guard: the defaults are null /
// absent, so a window that declares nothing must produce byte-identical output to
// before this feature existed. That is what keeps Phase A innocuous — the shared
// component keeps its maps as a fallback, so the 8 existing deleteActionFallback
// tests in the app-shell suite pass untouched.
//
// Runtime consumption of the emitted props is covered by the app-shell suite.

import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { generatePageComponent } from '../src/generate-frontend.js';

/** Minimal single-entity contract; `window` is spread over so each test can vary it. */
function buildContract(windowExtra = {}) {
  return {
    frontendContract: {
      window: {
        id: '902',
        name: 'Payment In',
        primaryEntity: 'finPayment',
        category: 'transaction',
        ...windowExtra,
      },
      entities: {
        finPayment: {
          fields: [
            {
              name: 'documentNo', column: 'DocumentNo',
              type: 'string', tsType: 'string',
              visibility: 'editable', required: true, grid: true, form: true,
            },
          ],
          searchableFields: ['documentNo'],
          computedFields: [],
        },
      },
    },
    backendContract: { processEndpoints: [] },
  };
}

describe('window.deleteAction — emitted DetailView prop', () => {
  it('emits deleteAction when the window declares it', () => {
    const code = generatePageComponent('finPayment', null, buildContract({
      deleteAction: 'eTPRRemovePayment',
    }));
    assert.match(code, /deleteAction="eTPRRemovePayment"/);
  });

  it('does NOT emit deleteAction when undeclared (R3 default)', () => {
    const code = generatePageComponent('finPayment', null, buildContract());
    assert.ok(!/deleteAction/.test(code), 'a window on the default must not carry deleteAction');
  });

  it('does NOT emit deleteAction for an explicitly null declaration', () => {
    const code = generatePageComponent('finPayment', null, buildContract({ deleteAction: null }));
    assert.ok(!/deleteAction/.test(code), 'null is the default and must not be emitted');
  });
});

describe('customComponents.deleteConfirmModal — emitted import and prop', () => {
  it('emits both the import and the prop when declared', () => {
    const code = generatePageComponent('finPayment', null, buildContract({
      customComponents: { deleteConfirmModal: 'PaymentLifecycleConfirmModal' },
    }));
    assert.match(code, /import PaymentLifecycleConfirmModal from /);
    assert.match(code, /deleteConfirmModal=\{PaymentLifecycleConfirmModal\}/);
  });

  it('does NOT emit anything when undeclared (R3 default)', () => {
    const code = generatePageComponent('finPayment', null, buildContract({ customComponents: {} }));
    assert.ok(!/deleteConfirmModal/.test(code), 'no delete cartel without the declaration');
  });

  it('emits the modal props object when declared alongside the modal', () => {
    const code = generatePageComponent('finPayment', null, buildContract({
      customComponents: {
        deleteConfirmModal: 'PaymentLifecycleConfirmModal',
        deleteConfirmModalProps: { dir: 'in' },
      },
    }));
    assert.match(code, /deleteConfirmModalProps=\{\{"dir":"in"\}\}/);
  });

  it('omits the props object when the modal is declared without it', () => {
    const code = generatePageComponent('finPayment', null, buildContract({
      customComponents: { deleteConfirmModal: 'PaymentLifecycleConfirmModal' },
    }));
    assert.match(code, /deleteConfirmModal=\{PaymentLifecycleConfirmModal\}/);
    assert.ok(!/deleteConfirmModalProps/.test(code), 'props are optional and default to absent');
  });

  it('never emits orphan props: declaring only the props object emits nothing', () => {
    // The props are gated on the modal (same nesting as sidePanelStyle under sidePanel),
    // so a config that sets only the payload cannot produce a dangling prop.
    const code = generatePageComponent('finPayment', null, buildContract({
      customComponents: { deleteConfirmModalProps: { dir: 'in' } },
    }));
    assert.ok(!/deleteConfirmModalProps/.test(code), 'props must not be emitted without the modal');
  });

  it('does not disturb the sibling processConfirmModal slot', () => {
    const code = generatePageComponent('finPayment', null, buildContract({
      customComponents: {
        processConfirmModal: 'ReactivarConfirmModal',
        deleteConfirmModal: 'PaymentLifecycleConfirmModal',
      },
    }));
    assert.match(code, /processConfirmModal=\{ReactivarConfirmModal\}/);
    assert.match(code, /deleteConfirmModal=\{PaymentLifecycleConfirmModal\}/);
  });
});

describe('delete cartel — R3 byte-identical control', () => {
  it('a window declaring none of the three produces output identical to an empty customComponents', () => {
    const bare = generatePageComponent('finPayment', null, buildContract());
    const empty = generatePageComponent('finPayment', null, buildContract({ customComponents: {} }));
    assert.equal(bare, empty, 'declaring nothing must not change a single byte');
  });
});

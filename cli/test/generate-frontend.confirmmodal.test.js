// Unit tests for buildProcessesArray — the `confirmModal` override.
// Lets a window opt a specific process into DetailView's confirm-modal gate
// (`processConfirmModal`) WITHOUT forcing its button into 'ghost-danger'
// styling (red border + undo icon), which is what a plain `style` override
// would do. Payments needs this: "Confirmar" must show a confirm dialog but
// stay styled as a normal ('positive') action button.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildProcessesArray } from '../src/generate-frontend.js';

describe('buildProcessesArray — confirmModal override', () => {
  it('emits confirmModal: true for a backend process when processOverrides sets it', () => {
    const out = buildProcessesArray({
      processes: [{ name: 'Payment Process', columnName: 'aPRMProcessPayment' }],
      buttonFields: [],
      processOverrides: {
        aPRMProcessPayment: { label: 'processConfirm', confirmModal: true },
      },
    });
    assert.match(out, /confirmModal: true/);
    assert.match(out, /style: 'positive'/);
  });

  it('omits confirmModal entirely when not set (default false-like behavior)', () => {
    const out = buildProcessesArray({
      processes: [{ name: 'Payment Process', columnName: 'aPRMProcessPayment' }],
      buttonFields: [],
      processOverrides: {
        aPRMProcessPayment: { label: 'processConfirm' },
      },
    });
    assert.ok(!/confirmModal/.test(out), 'confirmModal should not appear unless explicitly set');
  });

  it('does not force ghost-danger styling when confirmModal is set (stays positive)', () => {
    const out = buildProcessesArray({
      processes: [{ name: 'Payment Process', columnName: 'aPRMProcessPayment' }],
      buttonFields: [],
      processOverrides: {
        aPRMProcessPayment: { confirmModal: true },
      },
    });
    assert.ok(!/style: 'ghost-danger'/.test(out), 'confirmModal must not imply ghost-danger styling');
  });

  it('supports confirmModal on button-field-sourced processes too', () => {
    const out = buildProcessesArray({
      processes: [],
      buttonFields: [{ name: 'someButton', label: 'Some Button' }],
      processOverrides: {
        someButton: { confirmModal: true },
      },
    });
    assert.match(out, /confirmModal: true/);
  });

  it('supports confirmModal on decisions.json-only "add" processes too', () => {
    const out = buildProcessesArray({
      processes: [],
      buttonFields: [],
      processOverrides: {
        extraProcess: { add: true, columnName: 'extraProcess', confirmModal: true },
      },
    });
    assert.match(out, /confirmModal: true/);
  });

  it('leaves the existing ghost-danger process (e.g. reactivate) unaffected', () => {
    const out = buildProcessesArray({
      processes: [{ name: 'etprReactivatePayment', columnName: 'etprReactivatePayment' }],
      buttonFields: [],
      processOverrides: {
        etprReactivatePayment: { style: 'ghost-danger' },
      },
    });
    assert.match(out, /style: 'ghost-danger'/);
    assert.ok(!/confirmModal/.test(out));
  });
});

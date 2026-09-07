/**
 * `revision`, the flow<->user contract (ETP-5144).
 *
 * Distinct from `schemaVersion`, which is the engine<->flow contract. The
 * engine NEVER reads `revision`: it exists so a host launcher can tell a user
 * who completed revision 1 that revision 2 is worth another look. It is
 * author-managed, which is exactly why the normalizer must be forgiving (an
 * existing flow file with no `revision` is revision 1 and needs no edit) while
 * the validator must be strict (a garbage value is an authoring mistake worth
 * surfacing).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_FLOW_REVISION,
  normalizeFlow,
  normalizeRevision,
  validateFlow,
} from '../src/walkthrough/flowSchema.js';

/** Minimal valid step, so these cases are about the flow, not the steps. */
const STEP = Object.freeze({ id: 'open-new', targetTestId: 'new-button', bodyKey: 'body' });

function flow(overrides = {}) {
  return { id: 'create-contact', titleKey: 'title', steps: [STEP], ...overrides };
}

describe('DEFAULT_FLOW_REVISION', () => {
  it('is 1, so an un-revisioned flow counts as up to date', () => {
    assert.equal(DEFAULT_FLOW_REVISION, 1);
  });
});

describe('normalizeRevision', () => {
  it('passes a positive integer through', () => {
    assert.equal(normalizeRevision(1), 1);
    assert.equal(normalizeRevision(3), 3);
    assert.equal(normalizeRevision(42), 42);
  });

  it('falls back to 1 for anything that is not a revision counter', () => {
    for (const value of [undefined, null, 0, -1, 2.5, '3', 'x', true, NaN, Infinity, {}, []]) {
      assert.equal(
        normalizeRevision(value),
        DEFAULT_FLOW_REVISION,
        `expected ${JSON.stringify(value)} to normalize to ${DEFAULT_FLOW_REVISION}`,
      );
    }
  });
});

describe('normalizeFlow().revision', () => {
  it('defaults to 1 when the flow declares none', () => {
    assert.equal(normalizeFlow(flow()).revision, DEFAULT_FLOW_REVISION);
  });

  it('carries a declared revision through', () => {
    assert.equal(normalizeFlow(flow({ revision: 3 })).revision, 3);
  });

  it('falls back to 1 rather than emitting a nonsense revision', () => {
    assert.equal(normalizeFlow(flow({ revision: 0 })).revision, 1);
    assert.equal(normalizeFlow(flow({ revision: 2.5 })).revision, 1);
    assert.equal(normalizeFlow(flow({ revision: 'x' })).revision, 1);
  });
});

describe('validateFlow() on revision', () => {
  it('accepts an absent revision', () => {
    assert.deepEqual(validateFlow(flow()), []);
  });

  it('accepts a positive integer', () => {
    assert.deepEqual(validateFlow(flow({ revision: 2 })), []);
  });

  it('rejects a non-positive-integer revision', () => {
    for (const value of [0, -1, 2.5, '2', null, true, {}]) {
      const errors = validateFlow(flow({ revision: value }));
      assert.equal(
        errors.length,
        1,
        `expected exactly one error for revision ${JSON.stringify(value)}, got ${JSON.stringify(errors)}`,
      );
      assert.match(errors[0], /revision must be a positive integer when present/);
      assert.match(errors[0], /create-contact/);
    }
  });
});

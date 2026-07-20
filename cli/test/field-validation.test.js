import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildFieldValidation, projectValidation, VALIDATION_KEY_ORDER } from '../src/lib/field-validation.js';

// ─── ETP-4555 — constraint projection helper ──────────────────────────────────
describe('buildFieldValidation (ETP-4555)', () => {
  it('coerces raw string metadata to Number', () => {
    const v = buildFieldValidation({ raw: { maxLength: '60', valueMin: '0', valueMax: '100' } });
    assert.deepEqual(v, { maxLength: 60, minimum: 0, maximum: 100 });
  });

  it('gives decision precedence over raw for every numeric constraint', () => {
    const v = buildFieldValidation({
      raw: { maxLength: '60', valueMin: '0', valueMax: '100' },
      decision: { maxLength: 40, min: 5, max: 50 },
    });
    assert.deepEqual(v, { maxLength: 40, minimum: 5, maximum: 50 });
  });

  it('keeps minimum: 0 (decision) instead of dropping it as falsy', () => {
    const v = buildFieldValidation({ raw: { valueMin: '10' }, decision: { min: 0 } });
    assert.equal(v.minimum, 0);
  });

  it('mirrors required only when true', () => {
    assert.equal(buildFieldValidation({ required: true, decision: { minLength: 1 } }).required, true);
    assert.equal(buildFieldValidation({ required: false, decision: { minLength: 1 } }).required, undefined);
  });

  it('never infers format/enum/allowedSchemes from raw — decision only', () => {
    assert.equal(buildFieldValidation({ raw: { maxLength: '60' } }).format, undefined);
    const v = buildFieldValidation({ decision: { format: 'email', enum: ['A'], allowedSchemes: ['https'] } });
    assert.equal(v.format, 'email');
    assert.deepEqual(v.enum, ['A']);
    assert.deepEqual(v.allowedSchemes, ['https']);
  });

  it('returns undefined when no constraint applies (no guessed default)', () => {
    assert.equal(buildFieldValidation({ raw: {}, decision: {}, required: false }), undefined);
  });

  it('ignores blank-string raw values (guards Number("") === 0)', () => {
    assert.equal(buildFieldValidation({ raw: { valueMin: '', valueMax: '  ' } }), undefined);
  });

  it('drops NaN raw values', () => {
    assert.equal(buildFieldValidation({ raw: { maxLength: 'abc' } }), undefined);
  });

  it('emits keys in canonical order', () => {
    const v = buildFieldValidation({
      required: true,
      raw: { maxLength: '60', valueMin: '0', valueMax: '100' },
      decision: { minLength: 1, format: 'email', enum: ['A'], allowedSchemes: ['https'] },
    });
    assert.deepEqual(Object.keys(v), VALIDATION_KEY_ORDER);
  });

  it('drops empty arrays for enum/allowedSchemes', () => {
    assert.equal(buildFieldValidation({ decision: { enum: [], allowedSchemes: [] } }), undefined);
  });

  // Edge case (2) — maximum: 0 must survive (symmetric to minimum: 0).
  it('keeps maximum: 0 (decision) instead of dropping it as falsy', () => {
    const v = buildFieldValidation({ raw: { valueMax: '10' }, decision: { max: 0 } });
    assert.equal(v.maximum, 0);
    assert.ok(Object.prototype.hasOwnProperty.call(v, 'maximum'));
  });

  // Edge case (3) — explicit null metadata must be treated as absent (no key, no crash).
  it('treats explicit null raw and decision values as absent (no key, no crash)', () => {
    assert.equal(
      buildFieldValidation({
        raw: { maxLength: null, valueMin: null, valueMax: null },
        decision: { min: null, max: null, minLength: null, format: null, enum: null, allowedSchemes: null },
      }),
      undefined,
    );
  });

  // Edge case (3) — malformed object metadata coerces to NaN and is dropped (no crash).
  it('drops malformed object numeric metadata without crashing', () => {
    assert.equal(buildFieldValidation({ raw: { maxLength: {}, valueMin: {}, valueMax: {} } }), undefined);
  });

  // Edge case (6) — the helper is field-type agnostic. Boolean / date / FK / read-only
  // fields carry no numeric metadata, so no spurious constraint must be emitted.
  it('emits no spurious constraint for boolean/date/FK fields (no numeric metadata)', () => {
    // A boolean field: only decision.required is meaningful.
    assert.equal(buildFieldValidation({ raw: {}, decision: {}, required: false }), undefined);
    // A read-only/FK field that happens to be required still only mirrors required.
    assert.deepEqual(buildFieldValidation({ raw: {}, decision: {}, required: true }), { required: true });
    // A date field with no length/range metadata: nothing emitted.
    assert.equal(buildFieldValidation({ raw: { type: 'date' }, decision: {} }), undefined);
  });

  // Determinism — VALIDATION_KEY_ORDER is the sole authority; input key order is irrelevant.
  it('is deterministic: two builds with shuffled input keys serialize identically', () => {
    const decisionA = { allowedSchemes: ['https'], enum: ['A'], format: 'email', maxLength: 60, minLength: 1, max: 100, min: 0 };
    const decisionB = { min: 0, minLength: 1, maxLength: 60, max: 100, format: 'email', enum: ['A'], allowedSchemes: ['https'] };
    const a = buildFieldValidation({ required: true, decision: decisionA });
    const b = buildFieldValidation({ required: true, decision: decisionB });
    assert.equal(JSON.stringify(a), JSON.stringify(b));
    assert.deepEqual(Object.keys(a), VALIDATION_KEY_ORDER);
  });
});

describe('projectValidation (ETP-4555)', () => {
  it('reorders keys into canonical order and drops undefined', () => {
    const out = projectValidation({ maximum: 100, format: 'email', minimum: 0, undefinedKey: undefined });
    assert.deepEqual(Object.keys(out), ['minimum', 'maximum', 'format']);
  });

  it('returns undefined for empty or non-object input', () => {
    assert.equal(projectValidation({}), undefined);
    assert.equal(projectValidation(null), undefined);
    assert.equal(projectValidation(undefined), undefined);
  });
});

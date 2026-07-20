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

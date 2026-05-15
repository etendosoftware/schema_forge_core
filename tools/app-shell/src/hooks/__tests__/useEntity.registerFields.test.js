import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

/**
 * ETP-3894: tests for the multi-form registerFields / handleSave fix.
 *
 * The Map-based formFieldsRef is reproduced in isolation so the logic can be
 * exercised without a React renderer or any fetch infrastructure.
 *
 * Each test mirrors the exact logic in useEntity.js:
 *
 *   registerFields(fields, formId = '__default__')
 *     → if fields === null  → Map.delete(formId)
 *     → else               → Map.set(formId, Array.isArray(fields) ? fields : [])
 *
 *   handleSave validation (isNew branch)
 *     → fields = [...formFieldsRef.values()].flat()
 *     → find required + editable + visible + non-checkbox + non-summary fields
 *       whose value in editing is null / '' / whitespace-only
 */

// ---------------------------------------------------------------------------
// Inline reproduction of the register/flatten logic
// ---------------------------------------------------------------------------

function makeFormFieldsMap() {
  return new Map();
}

function registerFields(map, fields, formId = '__default__') {
  if (fields === null) {
    map.delete(formId);
  } else {
    map.set(formId, Array.isArray(fields) ? fields : []);
  }
}

function getValidationFields(map) {
  return [...map.values()].flat();
}

// Mirrors the isNew validation block inside useEntity.handleSave.
function findMissingRequired(editing, map) {
  const fields = getValidationFields(map);

  const isReadOnly = (f) => {
    if (f.readOnly === true) return true;
    try {
      return typeof f.readOnlyLogic === 'function'
        ? Boolean(f.readOnlyLogic(editing))
        : false;
    } catch {
      return false;
    }
  };

  const isVisible = (f) => {
    if (typeof f.displayLogic !== 'function') return true;
    try { return !!f.displayLogic(editing ?? {}); } catch { return true; }
  };

  return fields
    .filter(f =>
      f.required &&
      !isReadOnly(f) &&
      isVisible(f) &&
      f.type !== 'checkbox' &&
      f.section !== 'summary'
    )
    .filter(f => {
      const v = editing?.[f.key];
      return v == null || v === '' || (typeof v === 'string' && v.trim() === '');
    })
    .map(f => f.key);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const requiredField = (key) => ({ key, required: true, type: 'text' });
const optionalField = (key) => ({ key, required: false, type: 'text' });

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('registerFields — Map accumulation (ETP-3894)', () => {

  it('accumulates fields from multiple formIds', () => {
    const map = makeFormFieldsMap();
    registerFields(map, [requiredField('businessPartner')], 'form-1');
    registerFields(map, [requiredField('orderDate')], 'form-2');

    assert.equal(map.size, 2, 'Map must contain exactly 2 entries after two registrations');
    assert.ok(map.has('form-1'), 'form-1 must be present');
    assert.ok(map.has('form-2'), 'form-2 must be present');
  });

  it('cleanup removes only the matching formId', () => {
    const map = makeFormFieldsMap();
    registerFields(map, [requiredField('businessPartner')], 'form-1');
    registerFields(map, [requiredField('orderDate')], 'form-2');

    // Simulate EntityForm unmount cleanup: registerFields(null, formId)
    registerFields(map, null, 'form-1');

    assert.equal(map.size, 1, 'Map must contain 1 entry after cleanup of form-1');
    assert.ok(!map.has('form-1'), 'form-1 must be gone');
    assert.ok(map.has('form-2'), 'form-2 must still be present');
  });

  it('handleSave validates all forms combined', () => {
    const map = makeFormFieldsMap();
    // Two separate EntityForm instances, each with a required field.
    registerFields(map, [requiredField('businessPartner')], 'form-1');
    registerFields(map, [requiredField('orderDate')], 'form-2');

    // editing is empty — both fields are missing.
    const missing = findMissingRequired({}, map);
    assert.ok(missing.includes('businessPartner'), 'businessPartner must be flagged');
    assert.ok(missing.includes('orderDate'), 'orderDate must be flagged');
    assert.equal(missing.length, 2, 'Exactly 2 fields must be flagged');
  });

  it('last-write-wins regression is gone: second form does not overwrite first', () => {
    // Regression introduced before the fix: the old Array ref was overwritten on
    // every registerFields call, so the last EntityForm to mount "won" and the
    // first form's required fields were silently dropped from validation.
    //
    // With the Map fix, both sets of fields must coexist.
    const map = makeFormFieldsMap();
    registerFields(map, [requiredField('businessPartner')], 'form-1');
    // form-2 registers only a non-required field — it must NOT silence form-1's validation.
    registerFields(map, [optionalField('notes')], 'form-2');

    const missing = findMissingRequired({}, map);
    assert.ok(
      missing.includes('businessPartner'),
      'businessPartner (from form-1) must still be flagged even after form-2 registers'
    );
  });

  it('stale fields from unmounted form are excluded from validation', () => {
    const map = makeFormFieldsMap();
    registerFields(map, [requiredField('businessPartner')], 'form-1');

    // Simulate the cleanup effect from EntityForm unmount.
    registerFields(map, null, 'form-1');

    const missing = findMissingRequired({}, map);
    assert.deepEqual(
      missing,
      [],
      'No errors expected after the only form has been unmounted (cleanup path)'
    );
  });

});

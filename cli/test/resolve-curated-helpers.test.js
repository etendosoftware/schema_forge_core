import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  autoSimplifyEntityName,
  WINDOW_KEY_ORDER,
  reorderKeys,
} from '../src/resolve-curated.js';

// ---------------------------------------------------------------------------
// autoSimplifyEntityName
// ---------------------------------------------------------------------------

describe('autoSimplifyEntityName', () => {
  it('strips "c" prefix from cOrder → order', () => {
    assert.equal(autoSimplifyEntityName('cOrder'), 'order');
  });

  it('strips "c" prefix from cOrderLine → orderLine', () => {
    assert.equal(autoSimplifyEntityName('cOrderLine'), 'orderLine');
  });

  it('strips "m" prefix from mProduct → product', () => {
    assert.equal(autoSimplifyEntityName('mProduct'), 'product');
  });

  it('strips "ad" prefix from adUser → user', () => {
    assert.equal(autoSimplifyEntityName('adUser'), 'user');
  });

  it('does not strip prefixes that are not c/m/ad', () => {
    assert.equal(autoSimplifyEntityName('finPayment'), 'finPayment');
  });

  it('does not strip when prefix is not followed by uppercase', () => {
    assert.equal(autoSimplifyEntityName('calendar'), 'calendar');
  });

  it('returns null for null input', () => {
    assert.equal(autoSimplifyEntityName(null), null);
  });

  it('returns undefined for undefined input', () => {
    assert.equal(autoSimplifyEntityName(undefined), undefined);
  });

  it('returns empty string for empty string', () => {
    assert.equal(autoSimplifyEntityName(''), '');
  });

  it('converts slash-separated names to camelCase', () => {
    assert.equal(autoSimplifyEntityName('vendor/creditor'), 'vendorCreditor');
  });

  it('converts multi-slash names to camelCase', () => {
    assert.equal(autoSimplifyEntityName('a/b/c'), 'aBC');
  });

  it('strips prefix after slash conversion if result matches pattern', () => {
    // c + Something after slash conversion
    assert.equal(autoSimplifyEntityName('cOrder'), 'order');
  });

  it('handles single character after prefix', () => {
    assert.equal(autoSimplifyEntityName('cX'), 'x');
  });

  it('leaves names without matching prefix unchanged', () => {
    assert.equal(autoSimplifyEntityName('salesOrder'), 'salesOrder');
  });

  it('handles name that is just the prefix letters (no uppercase follows)', () => {
    assert.equal(autoSimplifyEntityName('mad'), 'mad');
  });
});

// ---------------------------------------------------------------------------
// WINDOW_KEY_ORDER
// ---------------------------------------------------------------------------

describe('WINDOW_KEY_ORDER', () => {
  it('is a non-empty array of strings', () => {
    assert.ok(Array.isArray(WINDOW_KEY_ORDER));
    assert.ok(WINDOW_KEY_ORDER.length > 0);
    for (const key of WINDOW_KEY_ORDER) {
      assert.equal(typeof key, 'string');
    }
  });

  it('starts with id and name', () => {
    assert.equal(WINDOW_KEY_ORDER[0], 'id');
    assert.equal(WINDOW_KEY_ORDER[1], 'name');
  });

  it('includes primaryEntity', () => {
    assert.ok(WINDOW_KEY_ORDER.includes('primaryEntity'));
  });

  it('includes category', () => {
    assert.ok(WINDOW_KEY_ORDER.includes('category'));
  });

  it('has no duplicate entries', () => {
    const unique = new Set(WINDOW_KEY_ORDER);
    assert.equal(unique.size, WINDOW_KEY_ORDER.length);
  });
});

// ---------------------------------------------------------------------------
// reorderKeys
// ---------------------------------------------------------------------------

describe('reorderKeys', () => {
  it('reorders keys according to canonical order', () => {
    const obj = { z: 3, a: 1, m: 2 };
    const result = reorderKeys(obj, ['a', 'm', 'z']);
    assert.deepEqual(Object.keys(result), ['a', 'm', 'z']);
    assert.deepEqual(result, { a: 1, m: 2, z: 3 });
  });

  it('puts canonical keys first, leftover sorted alphabetically', () => {
    const obj = { z: 4, name: 'test', id: '1', extra: 'x' };
    const result = reorderKeys(obj, ['id', 'name']);
    const keys = Object.keys(result);
    assert.equal(keys[0], 'id');
    assert.equal(keys[1], 'name');
    // leftover: extra, z (alphabetical)
    assert.equal(keys[2], 'extra');
    assert.equal(keys[3], 'z');
  });

  it('handles empty canonical order (all keys are leftover)', () => {
    const obj = { b: 2, a: 1 };
    const result = reorderKeys(obj, []);
    assert.deepEqual(Object.keys(result), ['a', 'b']);
  });

  it('handles empty object', () => {
    const result = reorderKeys({}, ['a', 'b']);
    assert.deepEqual(result, {});
  });

  it('ignores canonical keys not present in obj', () => {
    const obj = { name: 'x' };
    const result = reorderKeys(obj, ['id', 'name', 'missing']);
    assert.deepEqual(Object.keys(result), ['name']);
  });

  it('preserves all values through reordering', () => {
    const obj = { c: [1, 2], b: { nested: true }, a: null };
    const result = reorderKeys(obj, ['a', 'b', 'c']);
    assert.deepEqual(result.a, null);
    assert.deepEqual(result.b, { nested: true });
    assert.deepEqual(result.c, [1, 2]);
  });

  it('handles object with only canonical keys', () => {
    const obj = { id: '1', name: 'Test' };
    const result = reorderKeys(obj, ['id', 'name']);
    assert.deepEqual(Object.keys(result), ['id', 'name']);
  });

  it('handles object with only non-canonical keys', () => {
    const obj = { zebra: 1, apple: 2 };
    const result = reorderKeys(obj, ['id', 'name']);
    assert.deepEqual(Object.keys(result), ['apple', 'zebra']);
  });
});

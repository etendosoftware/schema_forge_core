import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { applyCalloutUpdates } from '../applyCalloutUpdates.js';

const noForce  = new Set();
const noTouch  = new Set();

describe('applyCalloutUpdates — normal guard (touched field preserved)', () => {
  it('applies callout value to an untouched field', () => {
    const prev    = { quantityCount: '', bookQuantity: '' };
    const updates = { quantityCount: 300, bookQuantity: 300 };
    const result  = applyCalloutUpdates(prev, updates, noForce, 'product', noTouch);
    assert.equal(result.quantityCount, 300);
    assert.equal(result.bookQuantity, 300);
  });

  it('preserves a touched field with a user value', () => {
    const prev    = { quantityCount: 50, bookQuantity: '' };
    const updates = { quantityCount: 300, bookQuantity: 300 };
    const touched = new Set(['quantityCount']);
    const result  = applyCalloutUpdates(prev, updates, noForce, 'product', touched);
    assert.equal(result.quantityCount, 50,  'touched field should be preserved');
    assert.equal(result.bookQuantity,  300, 'untouched field should be updated');
  });

  it('does not overwrite a non-empty field with empty/null', () => {
    const prev    = { quantityCount: 50 };
    const updates = { quantityCount: '' };
    const result  = applyCalloutUpdates(prev, updates, noForce, 'product', noTouch);
    assert.equal(result.quantityCount, 50);
  });

  it('does not overwrite a non-empty field with null', () => {
    const prev    = { quantityCount: 50 };
    const updates = { quantityCount: null };
    const result  = applyCalloutUpdates(prev, updates, noForce, 'product', noTouch);
    assert.equal(result.quantityCount, 50);
  });

  it('always applies callout value to the trigger field itself', () => {
    const prev    = { product: 'old-id' };
    const updates = { product: 'new-id' };
    const touched = new Set(['product']);
    const result  = applyCalloutUpdates(prev, updates, noForce, 'product', touched);
    assert.equal(result.product, 'new-id');
  });
});

describe('applyCalloutUpdates — forceFields bypass', () => {
  it('overwrites a touched field when it is in forceFields', () => {
    const prev      = { quantityCount: 50, bookQuantity: 100 };
    const updates   = { quantityCount: 300, bookQuantity: 300 };
    const touched   = new Set(['quantityCount', 'bookQuantity']);
    const forced    = new Set(['quantityCount', 'bookQuantity']);
    const result    = applyCalloutUpdates(prev, updates, forced, 'product', touched);
    assert.equal(result.quantityCount, 300, 'forced field should be overwritten');
    assert.equal(result.bookQuantity,  300, 'forced field should be overwritten');
  });

  it('overwrites with empty/null when field is in forceFields', () => {
    const prev    = { quantityCount: 50 };
    const updates = { quantityCount: '' };
    const forced  = new Set(['quantityCount']);
    const result  = applyCalloutUpdates(prev, updates, forced, 'product', noTouch);
    assert.equal(result.quantityCount, '');
  });

  it('only forces the declared fields — other touched fields still protected', () => {
    const prev    = { quantityCount: 50, description: 'my note' };
    const updates = { quantityCount: 300, description: 'auto desc' };
    const touched = new Set(['quantityCount', 'description']);
    const forced  = new Set(['quantityCount']);
    const result  = applyCalloutUpdates(prev, updates, forced, 'product', touched);
    assert.equal(result.quantityCount, 300,       'forced field overwritten');
    assert.equal(result.description,   'my note', 'non-forced touched field preserved');
  });
});

describe('applyCalloutUpdates — edge cases', () => {
  it('returns a new object (does not mutate prev)', () => {
    const prev    = { quantityCount: 50 };
    const updates = { quantityCount: 300 };
    const result  = applyCalloutUpdates(prev, updates, noForce, 'product', noTouch);
    assert.equal(prev.quantityCount, 50, 'prev must not be mutated');
    assert.equal(result.quantityCount, 300);
  });

  it('applies update when prev field is empty string (no user value)', () => {
    const prev    = { quantityCount: '' };
    const updates = { quantityCount: 300 };
    const touched = new Set(['quantityCount']);
    const result  = applyCalloutUpdates(prev, updates, noForce, 'product', touched);
    assert.equal(result.quantityCount, 300, 'empty string is not a user value — callout wins');
  });

  it('applies update when prev field is null (no user value)', () => {
    const prev    = { quantityCount: null };
    const updates = { quantityCount: 300 };
    const touched = new Set(['quantityCount']);
    const result  = applyCalloutUpdates(prev, updates, noForce, 'product', touched);
    assert.equal(result.quantityCount, 300, 'null is not a user value — callout wins');
  });

  it('handles empty updates gracefully', () => {
    const prev   = { quantityCount: 50 };
    const result = applyCalloutUpdates(prev, {}, noForce, 'product', noTouch);
    assert.deepStrictEqual(result, prev);
  });
});

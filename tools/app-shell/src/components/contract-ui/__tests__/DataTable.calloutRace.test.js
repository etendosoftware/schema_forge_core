import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(__dirname, '..', 'DataTable.jsx'), 'utf8');

/**
 * Regression guard for the callout race condition fix (ETP-3662).
 *
 * Bug: pressing Enter immediately after selecting a product saved the line
 * before the callout (product → taxRate → lineGrossAmount) had resolved,
 * storing incorrect values in Classic.
 *
 * Fix: InlineAddRow tracks in-flight callout promises (pendingCalloutsRef)
 * and a synchronous values mirror (valuesRef). submitLine awaits all pending
 * callouts and reads from the ref instead of the stale closure.
 */
describe('DataTable InlineAddRow — callout race condition fix (ETP-3662)', () => {

  // ── Refs ───────────────────────────────────────────────────────────────────

  it('declares valuesRef to mirror values synchronously outside React batching', () => {
    assert.match(src, /valuesRef\s*=\s*useRef\(/);
  });

  it('declares pendingCalloutsRef as an array to track in-flight callout promises', () => {
    assert.match(src, /pendingCalloutsRef\s*=\s*useRef\(\[\]\)/);
  });

  it('keeps valuesRef in sync on every render', () => {
    assert.match(src, /valuesRef\.current\s*=\s*values/);
  });

  // ── handleChange ───────────────────────────────────────────────────────────

  it('updates valuesRef synchronously inside handleChange before React batches', () => {
    assert.match(src, /valuesRef\.current\s*=\s*\{[^}]*valuesRef\.current[^}]*\}/);
  });

  // ── Reset ──────────────────────────────────────────────────────────────────

  it('resets pendingCalloutsRef when the form resets', () => {
    assert.match(src, /pendingCalloutsRef\.current\s*=\s*\[\]/);
  });

  // ── submitLine ─────────────────────────────────────────────────────────────

  it('awaits all pending callout promises before reading values in submitLine', () => {
    assert.match(src, /await\s+Promise\.all\(pendingCalloutsRef\.current\)/);
  });

  it('reads coercedValues from valuesRef.current instead of the stale closure', () => {
    assert.match(src, /coercedValues\s*=\s*\{[^}]*valuesRef\.current[^}]*\}/);
  });

  it('removes values from submitLine useCallback dependencies', () => {
    // values must NOT appear in the deps array after the submitLine callback.
    // The dep array closes the callback and must list only: data, fields, onAdd, onCancel.
    // We verify the absence of a bare `values` dep entry after `onCancel` in the dep array.
    assert.doesNotMatch(src, /\[data,\s*fields,\s*onAdd,\s*onCancel,\s*values\]/);
  });

  // ── handleFieldChange ──────────────────────────────────────────────────────

  it('captures the Promise returned by onFieldChange', () => {
    assert.match(src, /calloutPromise\s*=\s*onFieldChange\?\./);
  });

  it('pushes the callout promise into pendingCalloutsRef when it is a Promise', () => {
    assert.match(src, /pendingCalloutsRef\.current\.push\(calloutPromise\)/);
  });

  it('removes the promise from pendingCalloutsRef once it settles', () => {
    assert.match(src, /calloutPromise\.finally\(/);
    assert.match(src, /pendingCalloutsRef\.current\.filter\(p\s*=>\s*p\s*!==\s*calloutPromise\)/);
  });

  it('updates valuesRef synchronously inside applyUpdates before setValues', () => {
    // The applyUpdates callback must set valuesRef.current = next before calling setValues(next).
    assert.match(src, /valuesRef\.current\s*=\s*next[\s\S]{0,30}setValues\(next\)/);
  });

});

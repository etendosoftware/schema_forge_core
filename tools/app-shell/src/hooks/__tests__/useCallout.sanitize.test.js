import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Source-shape tests for `sanitizeCalloutMessage` in useCallout.js (ETP-4005).
 *
 * The function is internal (not exported). These regex-shape tests guard against
 * accidental regressions to the bounded-regex strategy (ReDoS-safe quantifiers)
 * and the list of acknowledged prefixes (Note/Warning/Error). The runtime side
 * is covered end-to-end by callout-message-sanitization.mocked.spec.js.
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(__dirname, '..', 'useCallout.js'), 'utf8');

describe('useCallout.js — sanitizeCalloutMessage', () => {
  it('declares an internal sanitizer function', () => {
    assert.match(src, /function sanitizeCalloutMessage\s*\(\s*raw\s*\)/);
  });

  it('strips <br> tags first via a bounded quantifier (ReDoS-safe)', () => {
    // The expectation is `<br[^>]{0,10}>` — bounded to prevent catastrophic
    // backtracking on hostile inputs.
    assert.match(src, /\.replace\(\s*\/<br\[\^>\]\{0,10\}>\/gi/);
  });

  it('strips remaining HTML tags via a second bounded quantifier', () => {
    // `<[^>]{0,200}>` — bounded to a sensible upper limit.
    assert.match(src, /\.replace\(\s*\/<\[\^>\]\{0,200\}>\/g/);
  });

  it('strips Note: / Warning: / Error: leading prefixes (case-insensitive)', () => {
    assert.match(src, /\.replace\(\s*\/\^\(Note\|Warning\|Error\):/);
    // The regex must use the /i flag (case-insensitive) so "note:" and "NOTE:"
    // both get stripped.
    assert.match(src, /Note\|Warning\|Error\):\\s\*\/i/);
  });

  it('trims surrounding whitespace as the final step', () => {
    // The trim must come AFTER the replaces so that "<br/> Note: msg "
    // collapses to "msg". Slice from the function start up to the next blank
    // line / closing brace at column 0.
    const fnStart = src.indexOf('function sanitizeCalloutMessage');
    assert.ok(fnStart >= 0, 'sanitizer function not found');
    const fnEnd = src.indexOf('\n}\n', fnStart);
    assert.ok(fnEnd > fnStart, 'sanitizer closing brace not found');
    const body = src.slice(fnStart, fnEnd + 3);
    assert.match(body, /\.trim\(\)/);
    // Order: at least one .replace appears before .trim()
    const trimIdx = body.indexOf('.trim()');
    const firstReplaceIdx = body.indexOf('.replace');
    assert.ok(firstReplaceIdx >= 0 && firstReplaceIdx < trimIdx, '.replace must appear before .trim');
  });

  it('does not use an unbounded quantifier like <[^>]*> (ReDoS smell)', () => {
    // Sanitizer must NOT contain unbounded `<[^>]*>` patterns — Sonar S5852.
    // Both replaces should carry an explicit {0,N} ceiling.
    const sanitizer = src.match(/function sanitizeCalloutMessage[\s\S]*?\n\}/);
    assert.ok(sanitizer);
    assert.doesNotMatch(sanitizer[0], /<\[\^>\]\*>/);
  });

  it('is invoked from the toast dispatch loop for every callout message', () => {
    // Each message goes through the sanitizer before any toast.* call.
    assert.match(src, /sanitizeCalloutMessage\(\s*msg\.text/);
  });

  it('dispatches toast.error / toast.warning / toast.info by message type', () => {
    assert.match(src, /type === 'ERROR'\) toast\.error/);
    assert.match(src, /type === 'WARNING'\) toast\.warning/);
    assert.match(src, /else toast\.info/);
  });

  it('skips empty messages after sanitization (no toast for empty strings)', () => {
    // `if (!text) continue;` — skips the toast when the sanitizer leaves an empty string.
    assert.match(src, /if \(!text\) continue;/);
  });
});

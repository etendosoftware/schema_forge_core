import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(__dirname, '..', 'movementAdvancedFilter.js'), 'utf8');

test('movementAdvancedFilter exports status label, column builder and filter helpers', () => {
  assert.match(src, /export function movementStatusLabelKey/);
  assert.match(src, /export function buildMovementFilterColumns/);
  assert.match(src, /export function applyAdvancedFilter/);
});

test('movementAdvancedFilter defines the operator dispatch table', () => {
  assert.match(src, /const OPERATORS = {/);
  assert.match(src, /iContains:/);
  assert.match(src, /between:/);
  assert.match(src, /inSet:/);
});

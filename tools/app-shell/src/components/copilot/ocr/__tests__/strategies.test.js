import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(__dirname, '..', 'strategies.js'), 'utf8');

describe('OCR strategy registries', () => {
  it('exports PRE_RESOLVERS and CREATE_COMPONENTS maps', () => {
    assert.match(src, /export const PRE_RESOLVERS\s*=\s*\{/);
    assert.match(src, /export const CREATE_COMPONENTS\s*=\s*\{/);
  });

  it('registers purchase-invoice vendor and tax resolvers by name', () => {
    assert.match(src, /findBp/);
    assert.match(src, /findTax/);
  });

  it('registers CreateContactModal by name', () => {
    assert.match(src, /CreateContactModal/);
  });
});

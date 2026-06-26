/**
 * Source-reading tests for AccountCodeField.jsx.
 *
 * These tests verify structural invariants of the component file without
 * executing it in a browser context. They run with Node.js test runner and
 * are useful as a lightweight gate before any Vitest environment is set up.
 */
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC_PATH = join(__dirname, '../AccountCodeField.jsx');

describe('AccountCodeField — source invariants', () => {
  let src;

  before(() => {
    src = readFileSync(SRC_PATH, 'utf-8');
  });

  it('exports a default function', () => {
    assert.match(src, /export default function AccountCodeField/);
  });

  it('uses data-testid="account-code-readonly" for summary/read-only display', () => {
    assert.match(src, /data-testid="account-code-readonly"/);
  });

  it('uses data-testid="account-code-prefix" for the locked prefix span', () => {
    assert.match(src, /data-testid="account-code-prefix"/);
  });

  it('uses data-testid="account-code-suffix-input" for the editable suffix input', () => {
    assert.match(src, /data-testid="account-code-suffix-input"/);
  });

  it('imports and uses the useUI hook from @/i18n', () => {
    assert.match(src, /from '@\/i18n'/);
    assert.match(src, /useUI\(\)/);
  });

  it('uses codeExact8Digits i18n key for the validation error', () => {
    assert.match(src, /codeExact8Digits/);
  });

  it('accepts value, onChange, record, readOnly props', () => {
    assert.match(src, /\{\s*value\s*.*onChange\s*.*record\s*.*readOnly/s);
  });
});

import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(__dirname, '..', 'useApiFetch.js'), 'utf8');

describe('useApiFetch', () => {
  it('exports a hook for authenticated API requests', () => {
    assert.match(src, /export function useApiFetch/);
  });

  it('centralizes token access through AuthContext instead of props', () => {
    assert.match(src, /useAuth\(\)/);
    assert.match(src, /createApiFetch/);
  });

  it('wires the global unauthorized handler to logout', () => {
    assert.match(src, /logout/);
    assert.match(src, /createApiFetch\([^)]*logout/s);
  });
});

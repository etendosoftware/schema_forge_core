import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const APP_SHELL = resolve(import.meta.dirname, '..');
const CONFIG = resolve(APP_SHELL, 'vite.config.js');

describe('mcp well-known middleware', () => {
  it('sets discovery CORS to the computed dev origin instead of a wildcard', () => {
    const src = readFileSync(CONFIG, 'utf8');

    assert.ok(
      src.includes("res.setHeader('Access-Control-Allow-Origin', base);"),
      'discovery middleware should reuse the computed request origin'
    );
    assert.ok(
      !src.includes("res.setHeader('Access-Control-Allow-Origin', '*');"),
      'discovery middleware should not expose a wildcard CORS header'
    );
  });
});

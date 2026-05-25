import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

test('public package exports the expected runtime entrypoints', async () => {
  const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));

  assert.equal(pkg.name, '@schema-forge/app-shell-core');
  assert.equal(pkg.exports['.'], './src/index.js');
  assert.equal(pkg.exports['./styles.css'], './src/styles.css');
});

test('core package does not import generated artifacts', async () => {
  const root = new URL('../src/', import.meta.url);
  const files = [
    'index.js',
    'auth/index.js',
    'i18n/index.js',
    'layout/index.js',
    'reports/index.js',
  ];

  for (const file of files) {
    const source = await readFile(join(root.pathname, file), 'utf8');
    assert.equal(source.includes('@generated'), false, `${file} should not import generated artifacts`);
  }
});

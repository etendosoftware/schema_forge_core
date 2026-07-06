import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

test('public package exports the expected runtime entrypoints', async () => {
  const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));

  assert.equal(pkg.name, '@etendosoftware/app-shell-core');
  assert.equal(pkg.exports['.'], './src/index.js');
  assert.equal(pkg.exports['./auth'], './src/auth/index.js');
  assert.equal(pkg.exports['./i18n'], './src/i18n/index.js');
  assert.equal(pkg.exports['./layout'], './src/layout/index.js');
  assert.equal(pkg.exports['./reports'], './src/reports/index.js');
  assert.equal(pkg.exports['./runtime'], './src/runtime/index.js');
  assert.equal(pkg.exports['./tailwind-preset'], './src/tailwind-preset.js');
  assert.equal(pkg.exports['./styles.css'], './src/styles.css');
  assert.equal(pkg.exports['./hooks/useCurrency.jsx'], './src/hooks/useCurrency.jsx');
  assert.equal(pkg.exports['./hooks/use-mobile.jsx'], './src/hooks/use-mobile.jsx');
  assert.equal(pkg.exports['./components/ui/*'], './src/components/ui/*');
  assert.equal(pkg.exports['./components/import/*'], './src/components/import/*');
  assert.equal(pkg.exports['./lib/*'], './src/lib/*');
});

async function listSourceFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listSourceFiles(path));
    } else if (/\.(?:js|jsx)$/.test(entry.name)) {
      files.push(path);
    }
  }
  return files;
}

test('core package source does not import app-shell implementation or generated artifacts', async () => {
  const root = new URL('../src/', import.meta.url);
  const forbidden = [
    /@generated/,
    /(?:from|import\()\s*['"]@\//,
    /(?:from|import\()\s*['"][^'"]*tools\/app-shell/,
    /(?:from|import\()\s*['"][^'"]*artifacts\//,
    /(?:from|import\()\s*['"]@schema-forge\/app-shell(?:['"/])/,
  ];

  for (const file of await listSourceFiles(root.pathname)) {
    const source = await readFile(file, 'utf8');
    for (const pattern of forbidden) {
      assert.equal(pattern.test(source), false, `${file} should not match ${pattern}`);
    }
  }
});

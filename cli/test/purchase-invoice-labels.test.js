import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..');

const decisionsPath = resolve(repoRoot, 'artifacts/purchase-invoice/decisions.json');
const mirrorPath = resolve(
  repoRoot,
  'tools/app-shell/src/windows/custom/purchase-invoice/index.jsx',
);

describe('purchase-invoice POReference label overrides', () => {
  it('decisions.json declares Nº documento (es_ES) and Document No. (en_US)', () => {
    const decisions = JSON.parse(readFileSync(decisionsPath, 'utf8'));
    const overrides = decisions.window?.labelOverrides;
    assert.ok(overrides, 'decisions.window.labelOverrides must be defined');
    assert.equal(overrides.es_ES?.POReference, 'Nº documento');
    assert.equal(overrides.en_US?.POReference, 'Document No.');
  });

  it('custom ListView mirror stays in sync with decisions.json overrides', () => {
    // The custom list wrapper bypasses the generated HeaderPage, so it carries
    // its own LABEL_OVERRIDES constant. Both must declare the same strings or
    // the grid and form will display different labels.
    const mirrorSrc = readFileSync(mirrorPath, 'utf8');
    assert.match(mirrorSrc, /POReference:\s*'Nº documento'/);
    assert.match(mirrorSrc, /POReference:\s*'Document No\.'/);
  });
});

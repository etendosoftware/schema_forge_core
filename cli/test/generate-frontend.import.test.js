import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getImportProp } from '../src/generate-frontend.js';

describe('getImportProp', () => {
  it('returns an empty string when import is not enabled', () => {
    assert.equal(getImportProp({ enabled: false }), '');
    assert.equal(getImportProp(undefined), '');
    assert.equal(getImportProp(null), '');
  });

  it('emits an import prop with the serialized config when enabled', () => {
    const out = getImportProp({ enabled: true, spec: 'contacts', fields: [{ target: 'name' }] });
    assert.match(out, /import=\{/);
    assert.match(out, /"spec":"contacts"/);
    assert.match(out, /"target":"name"/);
  });
});

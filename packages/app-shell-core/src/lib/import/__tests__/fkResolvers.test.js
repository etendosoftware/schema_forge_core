import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { registerFkResolver, getFkResolver } from '../fkResolvers.js';

describe('registerFkResolver / getFkResolver', () => {
  it('registers and retrieves a resolver by name', () => {
    const fn = async () => ({ status: 'auto-resolved', id: 'X', name: 'X' });
    registerFkResolver('test-resolver', fn);
    assert.equal(getFkResolver('test-resolver'), fn);
  });

  it('returns undefined for an unregistered name', () => {
    assert.equal(getFkResolver('nonexistent-resolver'), undefined);
  });

  it('overwrites a resolver registered twice under the same name', () => {
    const first = async () => ({ status: 'auto-resolved', id: 'A', name: 'A' });
    const second = async () => ({ status: 'auto-resolved', id: 'B', name: 'B' });
    registerFkResolver('overwrite-test', first);
    registerFkResolver('overwrite-test', second);
    assert.equal(getFkResolver('overwrite-test'), second);
  });
});

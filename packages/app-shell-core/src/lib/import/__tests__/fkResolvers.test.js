// @covers packages/app-shell-core/src/lib/import/fkResolvers.js
// @covers packages/app-shell-core/src/lib/import/importRunState.js
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { registerFkResolver, getFkResolver, resetFkResolverMemo } from '../fkResolvers.js';
import { registerImportRunReset, resetImportRun } from '../importRunState.js';

describe('registerFkResolver / getFkResolver', () => {
  it('registers and retrieves a resolver by name', async () => {
    const fn = async () => ({ status: 'auto-resolved', id: 'X', name: 'X' });
    registerFkResolver('test-resolver', fn);
    assert.deepEqual(await getFkResolver('test-resolver')('X', {}), { status: 'auto-resolved', id: 'X', name: 'X' });
  });

  it('returns undefined for an unregistered name', () => {
    assert.equal(getFkResolver('nonexistent-resolver'), undefined);
  });

  it('overwrites a resolver registered twice under the same name', async () => {
    const first = async () => ({ status: 'auto-resolved', id: 'A', name: 'A' });
    const second = async () => ({ status: 'auto-resolved', id: 'B', name: 'B' });
    registerFkResolver('overwrite-test', first);
    registerFkResolver('overwrite-test', second);
    assert.equal((await getFkResolver('overwrite-test')('v', {})).id, 'B');
  });
});

// ETP-5676 — the send phase re-resolved every foreign key per row, with no memory of what the
// preview had already answered and no sharing between the concurrent workers.
describe('registered resolvers — reuse of previewed and in-flight resolutions', () => {
  beforeEach(() => resetFkResolverMemo());

  const resolved = (id) => ({ status: 'auto-resolved', id, name: id });

  it('answers from the previewed resolution without calling the resolver', async () => {
    let calls = 0;
    registerFkResolver('memo-preview', async () => { calls += 1; return resolved('NET'); }, { target: 'uOM' });
    const fkResolutions = new Map([['uOM', new Map([['Kilo', resolved('KG')]])]]);
    const r = await getFkResolver('memo-preview')(' Kilo ', { token: 't', fkResolutions });
    assert.equal(r.id, 'KG');
    assert.equal(calls, 0);
  });

  it('does not trust a previewed resolution that still needs review', async () => {
    let calls = 0;
    registerFkResolver('memo-review', async () => { calls += 1; return resolved('NET'); }, { target: 'uOM' });
    const fkResolutions = new Map([['uOM', new Map([['Kilo', { status: 'needs-review', candidates: [] }]])]]);
    const r = await getFkResolver('memo-review')('Kilo', { token: 't', fkResolutions });
    assert.equal(r.id, 'NET');
    assert.equal(calls, 1);
  });

  it('shares one in-flight call between concurrent rows with the same value', async () => {
    let calls = 0;
    registerFkResolver('memo-concurrent', async () => { calls += 1; await new Promise((r) => setTimeout(r, 5)); return resolved('KG'); });
    const fn = getFkResolver('memo-concurrent');
    const out = await Promise.all(['Kilo', 'KILO', ' kilo '].map((v) => fn(v, { token: 't' })));
    assert.equal(calls, 1);
    assert.deepEqual(out.map((r) => r.id), ['KG', 'KG', 'KG']);
  });

  it('keeps distinct values and distinct tokens apart', async () => {
    let calls = 0;
    registerFkResolver('memo-distinct', async (v) => { calls += 1; return resolved(v); });
    const fn = getFkResolver('memo-distinct');
    await fn('a', { token: 't1' });
    await fn('b', { token: 't1' });
    await fn('a', { token: 't2' });
    assert.equal(calls, 3);
  });

  it('evicts a rejected resolution so the next call retries', async () => {
    let calls = 0;
    registerFkResolver('memo-reject', async () => {
      calls += 1;
      if (calls === 1) throw new Error('network');
      return resolved('OK');
    });
    const fn = getFkResolver('memo-reject');
    await assert.rejects(fn('x', { token: 't' }), /network/);
    assert.equal((await fn('x', { token: 't' })).id, 'OK');
    assert.equal(calls, 2);
  });

  it('forgets everything on a run reset and runs registered descriptor resets', async () => {
    let calls = 0;
    registerFkResolver('memo-reset', async () => { calls += 1; return resolved('KG'); });
    const fn = getFkResolver('memo-reset');
    await fn('x', { token: 't' });
    await fn('x', { token: 't' });
    assert.equal(calls, 1);
    let descriptorResets = 0;
    registerImportRunReset(() => { descriptorResets += 1; });
    resetImportRun();
    await fn('x', { token: 't' });
    assert.equal(calls, 2);
    assert.equal(descriptorResets, 1);
  });
});

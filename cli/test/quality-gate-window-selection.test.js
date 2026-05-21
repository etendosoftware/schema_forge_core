import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { getWindowNames, getAffectedWindows } from '../src/quality-gate.js';

function createSpy(returnValue) {
  const calls = [];
  const fn = (...args) => {
    calls.push(args);
    return returnValue;
  };
  fn.calls = calls;
  return fn;
}

describe('getWindowNames', () => {
  it('returns [windowName] when mode is "window"; detect fn NOT called', () => {
    const detect = createSpy(['should-not-return-this']);
    const result = getWindowNames(
      { mode: 'window', windowName: 'sales-order' },
      ['sales-order', 'purchase-order'],
      detect,
      ['file.js'],
      { blastRadius: ['shared/foo.js'] },
    );
    assert.deepEqual(result, ['sales-order']);
    assert.equal(detect.calls.length, 0);
  });

  it('returns all availableWindows when mode is "all"; detect fn NOT called', () => {
    const detect = createSpy([]);
    const result = getWindowNames(
      { mode: 'all' },
      ['sales-order', 'purchase-order'],
      detect,
      ['file.js'],
      {},
    );
    assert.deepEqual(result, ['sales-order', 'purchase-order']);
    assert.equal(detect.calls.length, 0);
  });

  it('calls detect fn with proper args when mode is "changed"', () => {
    const sentinel = ['detected-window'];
    const detect = createSpy(sentinel);
    const changedFiles = ['a.js', 'b.js'];
    const config = { blastRadius: ['shared/foo.js'] };
    const availableWindows = ['sales-order', 'purchase-order'];
    const result = getWindowNames(
      { mode: 'changed' },
      availableWindows,
      detect,
      changedFiles,
      config,
    );
    assert.equal(result, sentinel);
    assert.equal(detect.calls.length, 1);
    assert.deepEqual(detect.calls[0][0], {
      changedFiles,
      blastRadius: ['shared/foo.js'],
      availableWindows,
    });
  });

  it('defaults blastRadius to [] when config.blastRadius is missing', () => {
    const detect = createSpy([]);
    getWindowNames({ mode: 'changed' }, ['w1'], detect, [], {});
    assert.deepEqual(detect.calls[0][0].blastRadius, []);
  });

  it('passes config.blastRadius through when present', () => {
    const detect = createSpy([]);
    getWindowNames(
      { mode: 'changed' },
      ['w1'],
      detect,
      [],
      { blastRadius: ['shared/foo.js', 'shared/bar.js'] },
    );
    assert.deepEqual(detect.calls[0][0].blastRadius, ['shared/foo.js', 'shared/bar.js']);
  });
});

describe('getAffectedWindows', () => {
  it('returns [{ window, source: "direct" }] when mode is "window"; detect fn NOT called', () => {
    const detect = createSpy([]);
    const result = getAffectedWindows(
      { mode: 'window', windowName: 'sales-order' },
      ['sales-order', 'purchase-order'],
      detect,
      [],
      {},
    );
    assert.deepEqual(result, [{ window: 'sales-order', source: 'direct' }]);
    assert.equal(detect.calls.length, 0);
  });

  it('maps all availableWindows to direct entries when mode is "all"; detect fn NOT called', () => {
    const detect = createSpy([]);
    const result = getAffectedWindows(
      { mode: 'all' },
      ['sales-order', 'purchase-order'],
      detect,
      [],
      {},
    );
    assert.deepEqual(result, [
      { window: 'sales-order', source: 'direct' },
      { window: 'purchase-order', source: 'direct' },
    ]);
    assert.equal(detect.calls.length, 0);
  });

  it('calls detect fn with proper args when mode is "changed"', () => {
    const sentinel = [{ window: 'sales-order', source: 'blast-radius' }];
    const detect = createSpy(sentinel);
    const changedFiles = ['a.js'];
    const config = { blastRadius: ['shared/foo.js'] };
    const availableWindows = ['sales-order'];
    const result = getAffectedWindows(
      { mode: 'changed' },
      availableWindows,
      detect,
      changedFiles,
      config,
    );
    assert.equal(result, sentinel);
    assert.equal(detect.calls.length, 1);
    assert.deepEqual(detect.calls[0][0], {
      changedFiles,
      blastRadius: ['shared/foo.js'],
      availableWindows,
    });
  });

  it('defaults blastRadius to [] when config.blastRadius is missing', () => {
    const detect = createSpy([]);
    getAffectedWindows({ mode: 'changed' }, ['w1'], detect, [], {});
    assert.deepEqual(detect.calls[0][0].blastRadius, []);
  });

  it('passes config.blastRadius through when present', () => {
    const detect = createSpy([]);
    getAffectedWindows(
      { mode: 'changed' },
      ['w1'],
      detect,
      [],
      { blastRadius: ['shared/foo.js'] },
    );
    assert.deepEqual(detect.calls[0][0].blastRadius, ['shared/foo.js']);
  });
});

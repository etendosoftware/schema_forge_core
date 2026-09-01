import { describe, it, beforeEach } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  getRecordVersion, rememberRecordVersion, rememberRecordVersions,
  forgetRecordVersion, resetRecordVersionsForTests,
} from '../recordVersions.js';

// ETP-5073 / DOC-04. This store is what lets `apiFetch` attach the optimistic-locking token
// without every one of the ~41 update call sites threading `updated` through by hand.

describe('recordVersions', () => {
  beforeEach(() => resetRecordVersionsForTests());

  it('remembers a record\'s updated value and reads it back by id', () => {
    rememberRecordVersion({ id: 'A1', updated: '2026-08-28T10:00:00' });
    assert.equal(getRecordVersion('A1'), '2026-08-28T10:00:00');
  });

  it('returns undefined for a record it never saw, so apiFetch injects nothing', () => {
    // This is the guard that keeps the injection from corrupting a write to a non-NEO
    // endpoint (an OAuth2 PUT, a fiscal-config PUT): no entry, no injection.
    assert.equal(getRecordVersion('never-read'), undefined);
    assert.equal(getRecordVersion(null), undefined);
    assert.equal(getRecordVersion(undefined), undefined);
  });

  it('overwrites an existing entry, so a re-read wins over an older token', () => {
    rememberRecordVersion({ id: 'A1', updated: 'old' });
    rememberRecordVersion({ id: 'A1', updated: 'new' });
    assert.equal(getRecordVersion('A1'), 'new');
  });

  it('ignores anything that is not a record carrying both id and a non-empty updated', () => {
    // Callers sit on hot read paths and must not have to pre-check the shape.
    for (const input of [null, undefined, 42, 'x', [], [{ id: 'B', updated: 'v' }],
      { updated: 'no-id' }, { id: 'no-updated' }, { id: 'C', updated: '' },
      { id: 'D', updated: 123 }]) {
      assert.doesNotThrow(() => rememberRecordVersion(input));
    }
    assert.equal(getRecordVersion('B'), undefined, 'an array is not a record');
    assert.equal(getRecordVersion('C'), undefined, 'empty updated is not a token');
    assert.equal(getRecordVersion('D'), undefined, 'a non-string updated is not a token');
  });

  it('returns its argument unchanged, so it can be dropped into a parse pipeline', () => {
    const record = { id: 'A1', updated: 'v' };
    assert.equal(rememberRecordVersion(record), record);
    const rows = [{ id: 'A2', updated: 'v' }];
    assert.equal(rememberRecordVersions(rows), rows);
  });

  it('remembers every row of a list, which is what makes inline grid edits work', () => {
    rememberRecordVersions([
      { id: 'R1', updated: 'v1' },
      { id: 'R2', updated: 'v2' },
      null,
      { id: 'R3' },
    ]);
    assert.equal(getRecordVersion('R1'), 'v1');
    assert.equal(getRecordVersion('R2'), 'v2');
    assert.equal(getRecordVersion('R3'), undefined);
  });

  it('ignores a non-array passed to rememberRecordVersions', () => {
    assert.doesNotThrow(() => rememberRecordVersions({ id: 'X', updated: 'v' }));
    assert.equal(getRecordVersion('X'), undefined);
  });

  it('coerces ids to strings, so a numeric id and its string form are one entry', () => {
    rememberRecordVersion({ id: 7, updated: 'v' });
    assert.equal(getRecordVersion('7'), 'v');
    assert.equal(getRecordVersion(7), 'v');
  });

  it('forgets an entry, so an id reused by a later create inherits no stale token', () => {
    rememberRecordVersion({ id: 'A1', updated: 'v' });
    forgetRecordVersion('A1');
    assert.equal(getRecordVersion('A1'), undefined);
    assert.doesNotThrow(() => forgetRecordVersion(null));
  });

  it('evicts least-recently-used entries past the cap instead of growing forever', () => {
    // The cap is 5000. Filling it exactly, then adding one more, must drop the oldest —
    // and a dropped entry degrades to a loud 400 from the server, never a silent overwrite.
    for (let i = 0; i < 5000; i += 1) {
      rememberRecordVersion({ id: `R${i}`, updated: `v${i}` });
    }
    assert.equal(getRecordVersion('R0'), 'v0');
    assert.equal(getRecordVersion('R4999'), 'v4999');
    rememberRecordVersion({ id: 'OVERFLOW', updated: 'v' });
    // R0 was just read above, which refreshes its LRU position, so R1 is now the oldest.
    assert.equal(getRecordVersion('R1'), undefined, 'the least recently used entry is evicted');
    assert.equal(getRecordVersion('R0'), 'v0', 'a recently read entry survives');
    assert.equal(getRecordVersion('OVERFLOW'), 'v');
  });

  it('keeps a record alive by reading it, proving reads refresh LRU position', () => {
    rememberRecordVersion({ id: 'KEEP', updated: 'v' });
    for (let i = 0; i < 4999; i += 1) {
      rememberRecordVersion({ id: `F${i}`, updated: 'v' });
      getRecordVersion('KEEP');
    }
    rememberRecordVersion({ id: 'LAST', updated: 'v' });
    assert.equal(getRecordVersion('KEEP'), 'v');
  });
});

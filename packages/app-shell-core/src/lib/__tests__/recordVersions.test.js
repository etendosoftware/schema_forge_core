import { describe, it, beforeEach } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  getRecordVersion, rememberRecordVersion, rememberRecordVersions,
  forgetRecordVersion, resetRecordVersionsForTests,
} from '../recordVersions.js';

// ETP-5073 / DOC-04. This store is what lets `apiFetch` attach the optimistic-locking token
// without every one of the ~41 update call sites threading `updated` through by hand.

/**
 * Mirrors `MAX_TRACKED_RECORDS` in the module under test, which is module-private.
 *
 * Raised from 5000 to 20000 by ETP-5112: harvesting every row of every list GET (grids ask for
 * `_endRow=200`/`_endRow=500`) filled the old cap in 15-25 reads and started evicting rows the
 * user still had on screen, producing an intermittent 400 `missing_updated`. The eviction test
 * below fails if the production cap and this value ever drift apart.
 */
const CAP = 20000;

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
    // Filling the cap EXACTLY must keep every entry; one more must drop the oldest — which is
    // also what pins CAP to the production MAX_TRACKED_RECORDS: were the real cap lower, the
    // fill loop would already have evicted R0, and were it higher, OVERFLOW would evict nothing.
    // A dropped entry degrades to a loud 400 from the server, never a silent overwrite.
    for (let i = 0; i < CAP; i += 1) {
      rememberRecordVersion({ id: `R${i}`, updated: `v${i}` });
    }
    assert.equal(getRecordVersion('R0'), 'v0', 'the cap holds exactly CAP entries');
    assert.equal(getRecordVersion(`R${CAP - 1}`), `v${CAP - 1}`);
    rememberRecordVersion({ id: 'OVERFLOW', updated: 'v' });
    // R0 was just read above, which refreshes its LRU position, so R1 is now the oldest.
    assert.equal(getRecordVersion('R1'), undefined, 'the least recently used entry is evicted');
    assert.equal(getRecordVersion('R0'), 'v0', 'a recently read entry survives');
    assert.equal(getRecordVersion('OVERFLOW'), 'v');
  });

  it('keeps a record alive by reading it, proving reads refresh LRU position', () => {
    rememberRecordVersion({ id: 'KEEP', updated: 'v' });
    for (let i = 0; i < CAP - 1; i += 1) {
      rememberRecordVersion({ id: `F${i}`, updated: 'v' });
      getRecordVersion('KEEP');
    }
    rememberRecordVersion({ id: 'LAST', updated: 'v' });
    assert.equal(getRecordVersion('KEEP'), 'v');
  });

  it('evicts by RECORD ID, not by bucket, so a multi-entity record costs one slot', () => {
    // The outer map is what is bounded; an id read through several entities still occupies a
    // single slot, which is why harvesting every list row under its own entity did not change
    // the eviction arithmetic.
    rememberRecordVersion({ id: 'MULTI', updated: 'a' }, 'organization');
    rememberRecordVersion({ id: 'MULTI', updated: 'b' }, 'information');
    for (let i = 0; i < CAP - 1; i += 1) {
      rememberRecordVersion({ id: `G${i}`, updated: 'v' });
    }
    // CAP entries in total so far, so nothing has been evicted yet.
    assert.equal(getRecordVersion('MULTI', 'organization'), 'a');
    assert.equal(getRecordVersion('MULTI', 'information'), 'b');
  });
});

// ── ETP-5112: the composite (id, entity) key ────────────────────────────────
//
// An id is unique only WITHIN a table, and Etendo has one-to-one satellite tables that share
// their parent's primary key. Verified against the database: `ad_org` and `ad_orginfo` key on the
// same `ad_org_id` and carry DIFFERENT `updated` values. The Organization window reads
// `/organization/{id}` and `/information/{id}` and writes both, so an id-only key made the second
// read clobber the first one's token and sent one write out with the other row's version.

describe('recordVersions composite key (id, entity)', () => {
  beforeEach(() => resetRecordVersionsForTests());

  it('keeps one token per entity for an id two tables share (ad_org / ad_orginfo)', () => {
    // THE regression test of ETP-5112. This is the assertion the id-only design cannot satisfy.
    rememberRecordVersion({ id: 'O1', updated: 'ORG' }, 'organization');
    rememberRecordVersion({ id: 'O1', updated: 'INFO' }, 'information');
    assert.equal(getRecordVersion('O1', 'organization'), 'ORG');
    assert.equal(getRecordVersion('O1', 'information'), 'INFO');
  });

  it('answers undefined for an ambiguous id asked without an entity', () => {
    // Two rows, no way to choose: a guess would inject the other row's token and produce a 409
    // `stale_record` the user can neither explain nor resolve. A loud 400 `missing_updated` is
    // strictly the better failure.
    rememberRecordVersion({ id: 'O1', updated: 'ORG' }, 'organization');
    rememberRecordVersion({ id: 'O1', updated: 'INFO' }, 'information');
    assert.equal(getRecordVersion('O1'), undefined);
  });

  it('does not let a write under one entity refresh the other entity bucket', () => {
    rememberRecordVersion({ id: 'O1', updated: 'ORG-1' }, 'organization');
    rememberRecordVersion({ id: 'O1', updated: 'INFO-1' }, 'information');
    rememberRecordVersion({ id: 'O1', updated: 'ORG-2' }, 'organization');
    assert.equal(getRecordVersion('O1', 'organization'), 'ORG-2');
    assert.equal(getRecordVersion('O1', 'information'), 'INFO-1', 'the satellite is untouched');
  });

  it('remembers every row of a list under the entity it was read through', () => {
    rememberRecordVersions([
      { id: 'R1', updated: 'v1' }, { id: 'R2', updated: 'v2' },
    ], 'price');
    assert.equal(getRecordVersion('R1', 'price'), 'v1');
    assert.equal(getRecordVersion('R2', 'price'), 'v2');
  });
});

describe('getRecordVersion resolution cascade', () => {
  beforeEach(() => resetRecordVersionsForTests());

  it('prefers an exact entity match over the null bucket', () => {
    rememberRecordVersion({ id: 'A1', updated: 'no-context' });
    rememberRecordVersion({ id: 'A1', updated: 'exact' }, 'organization');
    assert.equal(getRecordVersion('A1', 'organization'), 'exact');
    assert.equal(getRecordVersion('A1', null), 'no-context');
  });

  it('falls back to the null bucket, which is what keeps the props-fed panels working', () => {
    // `useEntity` is handed a record, not a URL, so it remembers under `null`. ContactsTable and
    // ContactsFinancialPanel never read at all — they get `data` through props and then PATCH
    // `/businessPartner/{id}`, deriving entity `businessPartner`. This step is the only thing
    // that resolves that lookup.
    rememberRecordVersion({ id: 'BP1', updated: 'from-useEntity' });
    assert.equal(getRecordVersion('BP1', 'businessPartner'), 'from-useEntity');
  });

  it('returns the sole entry when the id was only ever seen under one other entity', () => {
    // A write whose path shape did not yield the same entity string as the read: there is only
    // one candidate, so there is nothing to confuse it with.
    rememberRecordVersion({ id: 'S1', updated: 'only' }, 'header');
    assert.equal(getRecordVersion('S1', 'lines'), 'only');
  });

  it('returns undefined when several entities hold the id and none is the one asked for', () => {
    rememberRecordVersion({ id: 'M1', updated: 'a' }, 'alpha');
    rememberRecordVersion({ id: 'M1', updated: 'b' }, 'beta');
    assert.equal(getRecordVersion('M1', 'gamma'), undefined);
  });

  it('treats the null entity as a real bucket, not as "any entity"', () => {
    rememberRecordVersion({ id: 'N1', updated: 'alpha-only' }, 'alpha');
    // Only one entry, so the sole-entry step answers it; adding a second makes it ambiguous.
    assert.equal(getRecordVersion('N1'), 'alpha-only');
    rememberRecordVersion({ id: 'N1', updated: 'beta-only' }, 'beta');
    assert.equal(getRecordVersion('N1'), undefined);
  });
});

describe('forgetRecordVersion', () => {
  beforeEach(() => resetRecordVersionsForTests());

  it('drops every bucket of an id when no entity is given, as the DELETE path needs', () => {
    // The row is gone, so no bucket for it can still be valid, and an id reused by a later
    // create must inherit nothing.
    rememberRecordVersion({ id: 'D1', updated: 'a' }, 'organization');
    rememberRecordVersion({ id: 'D1', updated: 'b' }, 'information');
    rememberRecordVersion({ id: 'D1', updated: 'c' });
    forgetRecordVersion('D1');
    assert.equal(getRecordVersion('D1', 'organization'), undefined);
    assert.equal(getRecordVersion('D1', 'information'), undefined);
    assert.equal(getRecordVersion('D1'), undefined);
  });

  it('drops only the named bucket when an entity is given', () => {
    // A satellite row deleted on its own while its parent, which shares the id, is on screen.
    // Three buckets, so the surviving ones stay ambiguous and the lookup for the dropped entity
    // cannot be answered by the sole-entry step of the cascade.
    rememberRecordVersion({ id: 'D2', updated: 'ORG' }, 'organization');
    rememberRecordVersion({ id: 'D2', updated: 'INFO' }, 'information');
    rememberRecordVersion({ id: 'D2', updated: 'ACCT' }, 'accounting');
    forgetRecordVersion('D2', 'information');
    assert.equal(getRecordVersion('D2', 'information'), undefined);
    assert.equal(getRecordVersion('D2', 'organization'), 'ORG');
    assert.equal(getRecordVersion('D2', 'accounting'), 'ACCT');
  });

  it('leaves the last surviving bucket answering for any entity, per the cascade', () => {
    // Not a leak: with a single entry there is nothing to confuse it with, and the sole-entry
    // step of `getRecordVersion` is what covers a write whose path shape does not reproduce the
    // read's entity string. Pinned here so the interaction with forget is deliberate.
    rememberRecordVersion({ id: 'D4', updated: 'ORG' }, 'organization');
    rememberRecordVersion({ id: 'D4', updated: 'INFO' }, 'information');
    forgetRecordVersion('D4', 'information');
    assert.equal(getRecordVersion('D4', 'information'), 'ORG');
  });

  it('drops the id entirely once its last bucket is forgotten', () => {
    rememberRecordVersion({ id: 'D5', updated: 'ORG' }, 'organization');
    forgetRecordVersion('D5', 'organization');
    assert.equal(getRecordVersion('D5', 'organization'), undefined);
    assert.equal(getRecordVersion('D5'), undefined);
  });

  it('is a no-op for an unknown id or an unknown bucket', () => {
    rememberRecordVersion({ id: 'D3', updated: 'ORG' }, 'organization');
    assert.doesNotThrow(() => forgetRecordVersion('nope', 'organization'));
    assert.doesNotThrow(() => forgetRecordVersion('D3', 'not-a-bucket'));
    assert.doesNotThrow(() => forgetRecordVersion(null, 'organization'));
    assert.equal(getRecordVersion('D3', 'organization'), 'ORG');
  });
});

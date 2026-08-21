import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  CURATED_VISIBILITIES,
  isCuratedVisibility,
  mapVisibility,
  visibilityMatchesFlags,
} from '../src/lib/field-visibility.js';
import { mapVisibility as mapVisibilityFromPushToNeo } from '../src/push-to-neo.js';

// ETP-4793 — this module is the single source of truth for the curated-visibility
// → NEO-flag projection. It previously existed twice (exported from push-to-neo.js,
// inlined in lib/neo-delta.js) and validator rule F23 would have been a third copy.

describe('mapVisibility', () => {
  it('projects each curated value to its documented flag pair', () => {
    assert.deepEqual(mapVisibility('editable'), { isIncluded: 'Y', isReadOnly: 'N' });
    assert.deepEqual(mapVisibility('readOnly'), { isIncluded: 'Y', isReadOnly: 'Y' });
    assert.deepEqual(mapVisibility('system'), { isIncluded: 'Y', isReadOnly: 'Y' });
    assert.deepEqual(mapVisibility('discarded'), { isIncluded: 'N', isReadOnly: 'N' });
  });

  it('collapses readOnly and system to the same pair', () => {
    // The lossy step that makes the VISIBILITY column necessary: the flags alone
    // cannot tell an agent which of the two it is looking at.
    assert.deepEqual(mapVisibility('readOnly'), mapVisibility('system'));
  });

  it('treats every non-curated value as closed', () => {
    for (const value of [null, undefined, '', 'EDITABLE', 'hidden', 0, false]) {
      assert.deepEqual(mapVisibility(value), { isIncluded: 'N', isReadOnly: 'N' },
        `expected ${JSON.stringify(value)} to project closed`);
    }
  });

  it('is the same function push-to-neo.js exports', () => {
    // push-to-neo re-exports it; the name is public API and callers must not get
    // a second implementation.
    assert.equal(mapVisibilityFromPushToNeo, mapVisibility);
  });
});

describe('isCuratedVisibility', () => {
  it('accepts exactly the four curated values', () => {
    for (const v of CURATED_VISIBILITIES) assert.equal(isCuratedVisibility(v), true, v);
    for (const v of [null, undefined, '', 'readonly', 'System']) {
      assert.equal(isCuratedVisibility(v), false, JSON.stringify(v));
    }
  });
});

describe('visibilityMatchesFlags', () => {
  it('accepts a row whose flags match its curated visibility', () => {
    const verdict = visibilityMatchesFlags({ visibility: 'readOnly', isIncluded: 'Y', isReadOnly: 'Y' });
    assert.equal(verdict.ok, true);
    assert.equal(verdict.kind, 'ok');
  });

  it('accepts a closed row that carries no visibility', () => {
    // N/N IS mapVisibility's default, so an absent VISIBILITY is coherent here.
    // The ETP-4793 exclude fix produces exactly these rows.
    assert.equal(visibilityMatchesFlags({ isIncluded: 'N', isReadOnly: 'N' }).ok, true);
    assert.equal(visibilityMatchesFlags({ visibility: null, isIncluded: 'N', isReadOnly: 'N' }).ok, true);
  });

  it('accepts a row that omits the flags entirely', () => {
    assert.equal(visibilityMatchesFlags({}).ok, true);
  });

  it('classifies a curated value disagreeing with the flags as a contradiction', () => {
    const verdict = visibilityMatchesFlags({ visibility: 'editable', isIncluded: 'N', isReadOnly: 'N' });
    assert.equal(verdict.ok, false);
    assert.equal(verdict.kind, 'contradiction');
    assert.deepEqual(verdict.expected, { isIncluded: 'Y', isReadOnly: 'N' });
  });

  it('classifies an included row with no visibility as unwritten, not a contradiction', () => {
    const verdict = visibilityMatchesFlags({ isIncluded: 'Y', isReadOnly: 'N' });
    assert.equal(verdict.ok, false);
    assert.equal(verdict.kind, 'unwritten');
  });

  it('classifies an unrecognised visibility string as unwritten', () => {
    // Not a contradiction: nothing in the pipeline can produce it, so blaming
    // the writer would be wrong. It is still incoherent and worth reporting.
    assert.equal(visibilityMatchesFlags({ visibility: 'bogus', isIncluded: 'Y', isReadOnly: 'N' }).kind,
      'unwritten');
  });

  it('catches the readOnly/system pair being stored as editable flags', () => {
    // The concrete IMP-26 shape: curation says readOnly, the runtime lets writes
    // through because ISREADONLY was never flipped.
    const verdict = visibilityMatchesFlags({ visibility: 'readOnly', isIncluded: 'Y', isReadOnly: 'N' });
    assert.equal(verdict.kind, 'contradiction');
    assert.deepEqual(verdict.expected, { isIncluded: 'Y', isReadOnly: 'Y' });
  });
});

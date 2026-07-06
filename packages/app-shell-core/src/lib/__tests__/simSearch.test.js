import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseSimSearchEnvelope } from '../simSearch.js';

describe('parseSimSearchEnvelope', () => {
  it('returns array of nulls when envelope is missing', () => {
    assert.deepEqual(parseSimSearchEnvelope(null, 3), [null, null, null]);
    assert.deepEqual(parseSimSearchEnvelope(undefined, 2), [null, null]);
    assert.deepEqual(parseSimSearchEnvelope({}, 2), [null, null]);
  });

  it('returns nulls when message is not a JSON string', () => {
    assert.deepEqual(parseSimSearchEnvelope({ message: 'not json' }, 1), [null]);
  });

  it('parses a single-item match envelope', () => {
    const envelope = {
      message: JSON.stringify({
        item_0: { data: [{ id: 'P-1', name: 'Widget', similarity_percent: '85' }] },
      }),
    };
    const result = parseSimSearchEnvelope(envelope, 1);
    assert.equal(result.length, 1);
    assert.equal(result[0].id, 'P-1');
    assert.equal(result[0].name, 'Widget');
    assert.equal(result[0].similarityPercent, '85');
  });

  it('preserves similarity_percent === 0 (does not coerce to null)', () => {
    const envelope = {
      message: JSON.stringify({
        item_0: { data: [{ id: 'P-2', name: 'Zero match', similarity_percent: 0 }] },
      }),
    };
    const [first] = parseSimSearchEnvelope(envelope, 1);
    assert.equal(first.similarityPercent, 0);
  });

  it('falls back to _identifier or id when name is missing', () => {
    const envelope = {
      message: JSON.stringify({
        item_0: { data: [{ id: 'P-3', _identifier: 'IDENT-3' }] },
      }),
    };
    const [first] = parseSimSearchEnvelope(envelope, 1);
    assert.equal(first.name, 'IDENT-3');
  });

  it('returns null for items with no data', () => {
    const envelope = {
      message: JSON.stringify({
        item_0: { data: [{ id: 'P-1' }] },
        item_1: { data: [] },
      }),
    };
    const result = parseSimSearchEnvelope(envelope, 2);
    assert.equal(result[0]?.id, 'P-1');
    assert.equal(result[1], null);
  });

  it('reads data from response.data when top-level data is missing', () => {
    const envelope = {
      message: JSON.stringify({
        item_0: { response: { data: [{ id: 'P-9', name: 'Nested' }] } },
      }),
    };
    const [first] = parseSimSearchEnvelope(envelope, 1);
    assert.equal(first.id, 'P-9');
  });

  it('pads missing items with null', () => {
    const envelope = { message: JSON.stringify({ item_0: { data: [{ id: 'A' }] } }) };
    const result = parseSimSearchEnvelope(envelope, 3);
    assert.equal(result.length, 3);
    assert.equal(result[1], null);
    assert.equal(result[2], null);
  });

  it('includes every match in .candidates, best-first', () => {
    const envelope = {
      message: JSON.stringify({
        item_0: {
          data: [
            { id: 'C-1', name: 'Kilogramo', similarity_percent: '92' },
            { id: 'C-2', name: 'Kilograma', similarity_percent: '78' },
          ],
        },
      }),
    };
    const [first] = parseSimSearchEnvelope(envelope, 1);
    assert.equal(first.candidates.length, 2);
    assert.deepEqual(first.candidates[0], { id: 'C-1', name: 'Kilogramo', similarityPercent: '92' });
    assert.deepEqual(first.candidates[1], { id: 'C-2', name: 'Kilograma', similarityPercent: '78' });
  });

  it('top-level id/name/similarityPercent mirror candidates[0] (back-compat)', () => {
    const envelope = {
      message: JSON.stringify({
        item_0: {
          data: [
            { id: 'C-1', name: 'Kilogramo', similarity_percent: '92' },
            { id: 'C-2', name: 'Kilograma', similarity_percent: '78' },
          ],
        },
      }),
    };
    const [first] = parseSimSearchEnvelope(envelope, 1);
    assert.equal(first.id, first.candidates[0].id);
    assert.equal(first.name, first.candidates[0].name);
    assert.equal(first.similarityPercent, first.candidates[0].similarityPercent);
  });

  it('a null result (no data) has no candidates to read', () => {
    const envelope = { message: JSON.stringify({ item_0: { data: [] } }) };
    const [first] = parseSimSearchEnvelope(envelope, 1);
    assert.equal(first, null);
  });

  it('regression: strips the real webhook\'s trailing "%" so downstream Number() parsing is never NaN', () => {
    // A live capture against the actual SimSearch webhook returned
    // `similarity_percent: "100.0000%"` — a formatted display string, not the
    // bare-digit string ("85") every other test here uses. classifyCandidates
    // does Number(similarityPercent) to compare against its auto-resolve
    // threshold; Number("100.0000%") is NaN, and NaN compared with `<` is
    // always false, so every real candidate silently passed as "confident
    // enough" regardless of actual match quality.
    const envelope = {
      message: JSON.stringify({
        item_0: { data: [{ id: '119', name: 'Argentina', similarity_percent: '100.0000%' }] },
      }),
    };
    const [first] = parseSimSearchEnvelope(envelope, 1);
    assert.equal(first.similarityPercent, '100.0000');
    assert.equal(Number(first.similarityPercent), 100);
  });

  it('regression: a bare numeric string (no "%") is left byte-for-byte unchanged', () => {
    const envelope = {
      message: JSON.stringify({
        item_0: { data: [{ id: 'P-1', name: 'Widget', similarity_percent: '85' }] },
      }),
    };
    const [first] = parseSimSearchEnvelope(envelope, 1);
    assert.equal(first.similarityPercent, '85');
  });
});

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
    assert.deepEqual(result[0], { id: 'P-1', name: 'Widget', similarityPercent: '85' });
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
});

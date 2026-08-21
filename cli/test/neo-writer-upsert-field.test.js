/**
 * Tests for upsertField in neo-writer.js, focused on the agentPrompt and
 * visibility columns and the partial-update contract (only explicitly provided
 * columns are SET).
 *
 * Uses a lightweight mock pg client that records the SQL and params of the
 * UPDATE/INSERT it receives, so no real database is needed.
 */
import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { upsertField, normalizeVisibility, FIELD_VISIBILITIES } from '../src/neo-writer.js';

function createMockClient() {
  const updates = [];
  const inserts = [];
  return {
    updates,
    inserts,
    query: async (sql, params) => {
      const s = sql.replace(/\s+/g, ' ').trim();
      if (s.startsWith('UPDATE etgo_sf_field')) {
        updates.push({ sql: s, params });
      } else if (s.startsWith('INSERT INTO etgo_sf_field')) {
        inserts.push({ sql: s, params });
      }
      return { rows: [] };
    },
  };
}

/**
 * Resolve the value bound to a named column of an INSERT, by reading the
 * column list out of the SQL instead of assuming a position. Positional
 * assertions ("the last param") silently pass onto the wrong column the next
 * time a column is appended — which is exactly what happened when `visibility`
 * was added after `agent_prompt`.
 */
function insertValue(insert, column) {
  const columns = insert.sql
    .slice(insert.sql.indexOf('(') + 1, insert.sql.indexOf(')'))
    .split(',')
    .map(c => c.trim());
  const index = columns.indexOf(column);
  assert.notEqual(index, -1, `column ${column} is present in the INSERT`);
  return insert.params[index];
}

describe('upsertField (agentPrompt)', () => {
  it('SETs agent_prompt on UPDATE when provided', async () => {
    const client = createMockClient();

    await upsertField(client, {
      entityId: 'ENT1',
      moduleId: 'MOD1',
      fieldId: 'FLD1',
      agentPrompt: 'Pick the warehouse closest to the customer.',
    });

    assert.equal(client.updates.length, 1);
    const { sql, params } = client.updates[0];
    assert.match(sql, /agent_prompt = \$\d+/);
    assert.ok(
      params.includes('Pick the warehouse closest to the customer.'),
      'prompt value is bound in the UPDATE params',
    );
  });

  it('omits agent_prompt from UPDATE when not provided (partial-update contract)', async () => {
    const client = createMockClient();

    await upsertField(client, {
      entityId: 'ENT1',
      moduleId: 'MOD1',
      fieldId: 'FLD1',
      isReadOnly: 'Y',
    });

    const { sql } = client.updates[0];
    assert.doesNotMatch(sql, /agent_prompt/);
  });

  it('persists agent_prompt on INSERT', async () => {
    const client = createMockClient();

    await upsertField(client, {
      entityId: 'ENT1',
      moduleId: 'MOD1',
      agentPrompt: 'Hint for a new field.',
    });

    assert.equal(client.inserts.length, 1);
    assert.equal(insertValue(client.inserts[0], 'agent_prompt'), 'Hint for a new field.');
  });

  it('defaults agent_prompt to null on INSERT when omitted', async () => {
    const client = createMockClient();

    await upsertField(client, { entityId: 'ENT1', moduleId: 'MOD1' });

    assert.equal(insertValue(client.inserts[0], 'agent_prompt'), null);
  });
});

describe('upsertField (visibility)', () => {
  it('persists visibility on INSERT', async () => {
    const client = createMockClient();

    await upsertField(client, { entityId: 'ENT1', moduleId: 'MOD1', visibility: 'system' });

    assert.equal(insertValue(client.inserts[0], 'visibility'), 'system');
  });

  it('defaults visibility to null on INSERT when omitted', async () => {
    const client = createMockClient();

    await upsertField(client, { entityId: 'ENT1', moduleId: 'MOD1' });

    assert.equal(insertValue(client.inserts[0], 'visibility'), null);
  });

  it('SETs visibility on UPDATE when provided', async () => {
    const client = createMockClient();

    await upsertField(client, {
      entityId: 'ENT1',
      moduleId: 'MOD1',
      fieldId: 'FLD1',
      visibility: 'readOnly',
    });

    const { sql, params } = client.updates[0];
    assert.match(sql, /visibility = \$\d+/);
    assert.ok(params.includes('readOnly'), 'visibility value is bound in the UPDATE params');
  });

  it('omits visibility from UPDATE when not provided (partial-update contract)', async () => {
    const client = createMockClient();

    await upsertField(client, {
      entityId: 'ENT1',
      moduleId: 'MOD1',
      fieldId: 'FLD1',
      isReadOnly: 'Y',
    });

    assert.doesNotMatch(client.updates[0].sql, /visibility/);
  });

  it('stores an explicit null when visibility is passed as null', async () => {
    const client = createMockClient();

    await upsertField(client, {
      entityId: 'ENT1',
      moduleId: 'MOD1',
      fieldId: 'FLD1',
      visibility: null,
    });

    const { sql, params } = client.updates[0];
    assert.match(sql, /visibility = \$\d+/);
    assert.ok(params.includes(null), 'null is bound, clearing a stale classification');
  });

  it('rejects a value outside the curated vocabulary', async () => {
    const client = createMockClient();

    await assert.rejects(
      () => upsertField(client, { entityId: 'ENT1', moduleId: 'MOD1', visibility: 'hidden' }),
      /invalid visibility "hidden"/,
    );
    assert.equal(client.inserts.length, 0, 'nothing is written when validation fails');
  });

  it('accepts every curated visibility value', async () => {
    for (const visibility of FIELD_VISIBILITIES) {
      const client = createMockClient();
      await upsertField(client, { entityId: 'ENT1', moduleId: 'MOD1', visibility });
      assert.equal(insertValue(client.inserts[0], 'visibility'), visibility);
    }
  });
});

describe('normalizeVisibility', () => {
  it('treats null and empty string as unclassified', () => {
    assert.equal(normalizeVisibility(null), null);
    assert.equal(normalizeVisibility(undefined), null);
    assert.equal(normalizeVisibility(''), null);
  });

  it('is case-sensitive — the vocabulary is camelCase', () => {
    assert.throws(() => normalizeVisibility('readonly'), /invalid visibility/);
  });
});

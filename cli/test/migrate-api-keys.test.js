import { describe, it, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  isPrimaryKey,
  buildRawFieldMap,
  loadJson,
  findRawEntity,
  migrateApiKeys,
  validateRawFieldConsistency,
} from '../src/migrate-api-keys.js';

describe('isPrimaryKey', () => {
  it('returns true for matching PK convention (exact case)', () => {
    assert.equal(isPrimaryKey('C_Order_ID', 'C_Order'), true);
  });

  it('matches case-insensitively', () => {
    assert.equal(isPrimaryKey('c_order_id', 'C_ORDER'), true);
    assert.equal(isPrimaryKey('C_ORDER_ID', 'c_order'), true);
  });

  it('returns false on mismatch', () => {
    assert.equal(isPrimaryKey('C_Order_ID', 'C_OrderLine'), false);
    assert.equal(isPrimaryKey('DocumentNo', 'C_Order'), false);
  });

  it('returns false when columnName is null/empty', () => {
    assert.equal(isPrimaryKey(null, 'C_Order'), false);
    assert.equal(isPrimaryKey('', 'C_Order'), false);
  });

  it('returns false when tableName is null/empty', () => {
    assert.equal(isPrimaryKey('C_Order_ID', null), false);
    assert.equal(isPrimaryKey('C_Order_ID', ''), false);
  });

  it('returns false when both inputs are missing', () => {
    assert.equal(isPrimaryKey(null, null), false);
    assert.equal(isPrimaryKey(undefined, undefined), false);
  });
});

describe('buildRawFieldMap', () => {
  it('builds a map keyed by columnName', () => {
    const map = buildRawFieldMap([
      { columnName: 'DocumentNo', name: 'documentNo' },
      { columnName: 'C_BPartner_ID', name: 'businessPartner' },
    ]);
    assert.equal(map.size, 2);
    assert.deepEqual(map.get('DocumentNo'), { columnName: 'DocumentNo', name: 'documentNo' });
    assert.equal(map.get('C_BPartner_ID').name, 'businessPartner');
  });

  it('ignores entries without columnName', () => {
    const map = buildRawFieldMap([
      { columnName: 'DocumentNo', name: 'documentNo' },
      { name: 'noColumn' },
      { columnName: '', name: 'emptyColumn' },
    ]);
    assert.equal(map.size, 1);
    assert.ok(map.has('DocumentNo'));
  });

  it('returns an empty Map for non-array input', () => {
    assert.equal(buildRawFieldMap(undefined).size, 0);
    assert.equal(buildRawFieldMap(null).size, 0);
    assert.equal(buildRawFieldMap({}).size, 0);
    assert.equal(buildRawFieldMap('nope').size, 0);
  });

  it('returns an empty Map for an empty array', () => {
    assert.equal(buildRawFieldMap([]).size, 0);
  });
});

describe('loadJson', () => {
  let dir;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'migrate-api-keys-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('parses a valid JSON file', async () => {
    const filePath = join(dir, 'valid.json');
    await writeFile(filePath, JSON.stringify({ hello: 'world', n: 42 }), 'utf-8');
    const result = await loadJson(filePath);
    assert.deepEqual(result, { hello: 'world', n: 42 });
  });

  it('returns null when the file is missing', async () => {
    const result = await loadJson(join(dir, 'does-not-exist.json'));
    assert.equal(result, null);
  });

  it('returns null on malformed JSON', async () => {
    const filePath = join(dir, 'broken.json');
    await writeFile(filePath, '{ not: valid json,,, }', 'utf-8');
    const result = await loadJson(filePath);
    assert.equal(result, null);
  });
});

describe('findRawEntity', () => {
  const rawSchema = {
    entities: [
      { tableName: 'C_Order', tabName: 'Header' },
      { tableName: 'C_OrderLine', tabName: 'Lines' },
    ],
  };

  it('matches by tableName', () => {
    const found = findRawEntity(rawSchema, { tableName: 'C_OrderLine' });
    assert.equal(found.tabName, 'Lines');
  });

  it('falls back to tabName when tableName is absent', () => {
    const found = findRawEntity(rawSchema, { tabName: 'Header' });
    assert.equal(found.tableName, 'C_Order');
  });

  it('returns null when rawSchema is null or has no entities', () => {
    assert.equal(findRawEntity(null, { tableName: 'C_Order' }), null);
    assert.equal(findRawEntity({}, { tableName: 'C_Order' }), null);
    assert.equal(findRawEntity({ entities: undefined }, { tableName: 'C_Order' }), null);
  });

  it('returns null when no entity matches by tableName', () => {
    assert.equal(findRawEntity(rawSchema, { tableName: 'C_Unknown' }), null);
  });

  it('returns null when no entity matches by tabName', () => {
    assert.equal(findRawEntity(rawSchema, { tabName: 'Unknown' }), null);
  });

  it('returns null when curated entity has neither tableName nor tabName', () => {
    assert.equal(findRawEntity(rawSchema, {}), null);
  });
});

describe('migrateApiKeys', () => {
  it('sets apiKey to field.name for fields without apiKey and counts migrations', () => {
    const curated = {
      entities: [
        {
          tableName: 'C_Order',
          fields: [
            { name: 'documentNo', column: 'DocumentNo' },
            { name: 'businessPartner', column: 'C_BPartner_ID' },
          ],
        },
      ],
    };
    const result = migrateApiKeys(curated, null, 0, 'sales-order', 0);
    assert.deepEqual(result, { fileFieldsSkipped: 0, fileFieldsMigrated: 2 });
    assert.equal(curated.entities[0].fields[0].apiKey, 'documentNo');
    assert.equal(curated.entities[0].fields[1].apiKey, 'businessPartner');
  });

  it('skips fields that already define apiKey (truthy)', () => {
    const curated = {
      entities: [
        {
          tableName: 'C_Order',
          fields: [{ name: 'documentNo', apiKey: 'existing' }],
        },
      ],
    };
    const result = migrateApiKeys(curated, null, 0, 'sales-order', 0);
    assert.deepEqual(result, { fileFieldsSkipped: 1, fileFieldsMigrated: 0 });
    // unchanged
    assert.equal(curated.entities[0].fields[0].apiKey, 'existing');
  });

  it('skips fields whose apiKey is defined but falsy (checks !== undefined)', () => {
    const curated = {
      entities: [
        {
          tableName: 'C_Order',
          fields: [
            { name: 'a', apiKey: '' },
            { name: 'b', apiKey: null },
          ],
        },
      ],
    };
    const result = migrateApiKeys(curated, null, 0, 'sales-order', 0);
    assert.deepEqual(result, { fileFieldsSkipped: 2, fileFieldsMigrated: 0 });
    assert.equal(curated.entities[0].fields[0].apiKey, '');
    assert.equal(curated.entities[0].fields[1].apiKey, null);
  });

  it('mixes skipped and migrated fields and returns correct totals', () => {
    const curated = {
      entities: [
        {
          tableName: 'C_Order',
          fields: [
            { name: 'a', apiKey: 'a' },
            { name: 'b' },
            { name: 'c' },
          ],
        },
      ],
    };
    const result = migrateApiKeys(curated, null, 0, 'sales-order', 0);
    assert.deepEqual(result, { fileFieldsSkipped: 1, fileFieldsMigrated: 2 });
  });

  it('skips entities whose fields is not an array', () => {
    const curated = {
      entities: [
        { tableName: 'C_Order', fields: undefined },
        { tableName: 'C_OrderLine' },
        { tableName: 'C_Other', fields: { not: 'an array' } },
      ],
    };
    const result = migrateApiKeys(curated, null, 0, 'sales-order', 0);
    assert.deepEqual(result, { fileFieldsSkipped: 0, fileFieldsMigrated: 0 });
  });

  it('works with a rawSchema present (raw matching path)', () => {
    const curated = {
      entities: [
        {
          name: 'Header',
          tableName: 'C_Order',
          fields: [{ name: 'documentNo', column: 'DocumentNo' }],
        },
      ],
    };
    const rawSchema = {
      entities: [
        {
          tableName: 'C_Order',
          tabName: 'Header',
          fields: [{ columnName: 'DocumentNo', name: 'documentNo' }],
        },
      ],
    };
    const result = migrateApiKeys(curated, rawSchema, 0, 'sales-order', 0);
    assert.deepEqual(result, { fileFieldsSkipped: 0, fileFieldsMigrated: 1 });
    assert.equal(curated.entities[0].fields[0].apiKey, 'documentNo');
  });

  it('preserves running counters passed in as starting values', () => {
    const curated = {
      entities: [{ tableName: 'C_Order', fields: [{ name: 'x' }] }],
    };
    const result = migrateApiKeys(curated, null, 5, 'sales-order', 10);
    assert.deepEqual(result, { fileFieldsSkipped: 5, fileFieldsMigrated: 11 });
  });
});

describe('validateRawFieldConsistency', () => {
  function captureConsole(fn) {
    const original = console.log;
    const lines = [];
    console.log = (...args) => lines.push(args.join(' '));
    try {
      fn();
    } finally {
      console.log = original;
    }
    return lines;
  }

  it('logs a NOTE when the raw name differs from the curated name', () => {
    const map = buildRawFieldMap([{ columnName: 'DocumentNo', name: 'oldName' }]);
    const field = { name: 'documentNo', column: 'DocumentNo' };
    const lines = captureConsole(() =>
      validateRawFieldConsistency(map, field, 'sales-order', { name: 'Header' }),
    );
    assert.equal(lines.length, 1);
    assert.match(lines[0], /NOTE sales-order\/Header/);
    assert.match(lines[0], /raw name was "oldName"/);
  });

  it('is a no-op when the map is empty', () => {
    const lines = captureConsole(() =>
      validateRawFieldConsistency(new Map(), { name: 'x', column: 'X' }, 'w', { name: 'E' }),
    );
    assert.equal(lines.length, 0);
  });

  it('is a no-op when the field has no column', () => {
    const map = buildRawFieldMap([{ columnName: 'DocumentNo', name: 'oldName' }]);
    const lines = captureConsole(() =>
      validateRawFieldConsistency(map, { name: 'documentNo' }, 'w', { name: 'E' }),
    );
    assert.equal(lines.length, 0);
  });

  it('is a no-op when the raw name matches the curated name', () => {
    const map = buildRawFieldMap([{ columnName: 'DocumentNo', name: 'documentNo' }]);
    const field = { name: 'documentNo', column: 'DocumentNo' };
    const lines = captureConsole(() =>
      validateRawFieldConsistency(map, field, 'w', { name: 'E' }),
    );
    assert.equal(lines.length, 0);
  });

  it('is a no-op when the rawField is not found for the column', () => {
    const map = buildRawFieldMap([{ columnName: 'DocumentNo', name: 'oldName' }]);
    const field = { name: 'x', column: 'NotInMap' };
    const lines = captureConsole(() =>
      validateRawFieldConsistency(map, field, 'w', { name: 'E' }),
    );
    assert.equal(lines.length, 0);
  });

  it('is a no-op when rawField has no name', () => {
    const map = buildRawFieldMap([{ columnName: 'DocumentNo' }]);
    const field = { name: 'documentNo', column: 'DocumentNo' };
    const lines = captureConsole(() =>
      validateRawFieldConsistency(map, field, 'w', { name: 'E' }),
    );
    assert.equal(lines.length, 0);
  });
});

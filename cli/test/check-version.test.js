import { describe, it, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import {
  diffFields,
  diffEntities,
  diffContract,
  classifyChanges,
  bumpVersion,
  buildChangelogEntry,
  checkVersion,
} from '../src/check-version.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..', '..');

// --- diffFields ---

describe('diffFields', () => {
  it('detects added fields', () => {
    const oldFields = [
      { name: 'documentNo', column: 'DocumentNo', type: 'string' },
    ];
    const newFields = [
      { name: 'documentNo', column: 'DocumentNo', type: 'string' },
      { name: 'dateOrdered', column: 'DateOrdered', type: 'date' },
    ];
    const result = diffFields(oldFields, newFields);
    assert.equal(result.added.length, 1);
    assert.equal(result.added[0].name, 'dateOrdered');
    assert.equal(result.removed.length, 0);
    assert.equal(result.changed.length, 0);
  });

  it('detects removed fields', () => {
    const oldFields = [
      { name: 'documentNo', column: 'DocumentNo', type: 'string' },
      { name: 'dateOrdered', column: 'DateOrdered', type: 'date' },
    ];
    const newFields = [
      { name: 'documentNo', column: 'DocumentNo', type: 'string' },
    ];
    const result = diffFields(oldFields, newFields);
    assert.equal(result.added.length, 0);
    assert.equal(result.removed.length, 1);
    assert.equal(result.removed[0].name, 'dateOrdered');
    assert.equal(result.changed.length, 0);
  });

  it('detects changed fields with per-property diffs', () => {
    const oldFields = [
      { name: 'documentNo', column: 'DocumentNo', type: 'string', required: false, grid: true },
    ];
    const newFields = [
      { name: 'documentNo', column: 'DocumentNo', type: 'integer', required: true, grid: true },
    ];
    const result = diffFields(oldFields, newFields);
    assert.equal(result.added.length, 0);
    assert.equal(result.removed.length, 0);
    assert.equal(result.changed.length, 1);
    assert.equal(result.changed[0].name, 'documentNo');
    const props = result.changed[0].properties;
    assert.ok(props.find(p => p.property === 'type' && p.from === 'string' && p.to === 'integer'));
    assert.ok(props.find(p => p.property === 'required' && p.from === false && p.to === true));
    // grid did not change, should not be listed
    assert.ok(!props.find(p => p.property === 'grid'));
  });

  it('returns empty diff for identical fields', () => {
    const fields = [
      { name: 'documentNo', column: 'DocumentNo', type: 'string', required: true },
      { name: 'dateOrdered', column: 'DateOrdered', type: 'date', required: false },
    ];
    const result = diffFields(fields, fields);
    assert.equal(result.added.length, 0);
    assert.equal(result.removed.length, 0);
    assert.equal(result.changed.length, 0);
  });
});

// --- diffEntities / diffContract ---

const makeContract = (entities, endpoints) => ({
  version: '0.1.0',
  checksum: 'abc123',
  frontendContract: { entities },
  backendContract: { entities, endpoints: endpoints || [] },
});

describe('diffEntities', () => {
  it('detects added entity', () => {
    const oldEntities = {
      order: { fields: [{ name: 'documentNo', type: 'string' }] },
    };
    const newEntities = {
      order: { fields: [{ name: 'documentNo', type: 'string' }] },
      line: { fields: [{ name: 'product', type: 'string' }] },
    };
    const result = diffEntities(oldEntities, newEntities);
    assert.deepEqual(result.addedEntities, ['line']);
    assert.deepEqual(result.removedEntities, []);
  });

  it('detects removed entity', () => {
    const oldEntities = {
      order: { fields: [{ name: 'documentNo', type: 'string' }] },
      line: { fields: [{ name: 'product', type: 'string' }] },
    };
    const newEntities = {
      order: { fields: [{ name: 'documentNo', type: 'string' }] },
    };
    const result = diffEntities(oldEntities, newEntities);
    assert.deepEqual(result.addedEntities, []);
    assert.deepEqual(result.removedEntities, ['line']);
  });

  it('detects field diffs within entities', () => {
    const oldEntities = {
      order: { fields: [{ name: 'documentNo', type: 'string' }] },
    };
    const newEntities = {
      order: { fields: [{ name: 'documentNo', type: 'integer' }] },
    };
    const result = diffEntities(oldEntities, newEntities);
    assert.deepEqual(result.addedEntities, []);
    assert.deepEqual(result.removedEntities, []);
    assert.ok(result.entityDiffs.order);
    assert.equal(result.entityDiffs.order.changed.length, 1);
  });

  it('returns null-like diff for identical entities', () => {
    const entities = {
      order: { fields: [{ name: 'documentNo', type: 'string' }] },
    };
    const result = diffEntities(entities, entities);
    assert.deepEqual(result.addedEntities, []);
    assert.deepEqual(result.removedEntities, []);
    assert.deepEqual(result.entityDiffs, {});
  });
});

describe('diffContract', () => {
  it('returns null for identical contracts', () => {
    const contract = makeContract(
      { order: { fields: [{ name: 'documentNo', type: 'string' }] } },
      [{ method: 'GET', path: '/order' }]
    );
    const result = diffContract(contract, contract);
    assert.equal(result, null);
  });

  it('detects endpoint changes', () => {
    const oldContract = makeContract(
      { order: { fields: [{ name: 'documentNo', type: 'string' }] } },
      [{ method: 'GET', path: '/order' }]
    );
    const newContract = makeContract(
      { order: { fields: [{ name: 'documentNo', type: 'string' }] } },
      []
    );
    const result = diffContract(oldContract, newContract);
    assert.notEqual(result, null);
    assert.equal(result.endpoints.removed.length, 1);
  });
});

// --- classifyChanges ---

describe('classifyChanges', () => {
  it('classifies field removal as breaking', () => {
    const diff = {
      frontend: { addedEntities: [], removedEntities: [], entityDiffs: {
        order: { added: [], removed: [{ name: 'price' }], changed: [] }
      }},
      backend: { addedEntities: [], removedEntities: [], entityDiffs: {} },
      endpoints: { added: [], removed: [] },
    };
    const result = classifyChanges(diff);
    assert.equal(result.level, 'breaking');
    assert.ok(result.reasons.some(r => r.includes('removed')));
  });

  it('classifies field addition as additive', () => {
    const diff = {
      frontend: { addedEntities: [], removedEntities: [], entityDiffs: {
        order: { added: [{ name: 'discount' }], removed: [], changed: [] }
      }},
      backend: { addedEntities: [], removedEntities: [], entityDiffs: {} },
      endpoints: { added: [], removed: [] },
    };
    const result = classifyChanges(diff);
    assert.equal(result.level, 'additive');
  });

  it('classifies entity removal as breaking', () => {
    const diff = {
      frontend: { addedEntities: [], removedEntities: ['line'], entityDiffs: {} },
      backend: { addedEntities: [], removedEntities: [], entityDiffs: {} },
      endpoints: { added: [], removed: [] },
    };
    const result = classifyChanges(diff);
    assert.equal(result.level, 'breaking');
  });

  it('classifies endpoint removal as breaking', () => {
    const diff = {
      frontend: { addedEntities: [], removedEntities: [], entityDiffs: {} },
      backend: { addedEntities: [], removedEntities: [], entityDiffs: {} },
      endpoints: { added: [], removed: [{ method: 'GET', path: '/order' }] },
    };
    const result = classifyChanges(diff);
    assert.equal(result.level, 'breaking');
  });

  it('classifies type change as breaking', () => {
    const diff = {
      frontend: { addedEntities: [], removedEntities: [], entityDiffs: {
        order: { added: [], removed: [], changed: [
          { name: 'amount', properties: [{ property: 'type', from: 'string', to: 'integer' }] }
        ]}
      }},
      backend: { addedEntities: [], removedEntities: [], entityDiffs: {} },
      endpoints: { added: [], removed: [] },
    };
    const result = classifyChanges(diff);
    assert.equal(result.level, 'breaking');
  });

  it('classifies grid change as patch', () => {
    const diff = {
      frontend: { addedEntities: [], removedEntities: [], entityDiffs: {
        order: { added: [], removed: [], changed: [
          { name: 'notes', properties: [{ property: 'grid', from: true, to: false }] }
        ]}
      }},
      backend: { addedEntities: [], removedEntities: [], entityDiffs: {} },
      endpoints: { added: [], removed: [] },
    };
    const result = classifyChanges(diff);
    assert.equal(result.level, 'patch');
  });

  it('uses highest severity when mixed changes exist', () => {
    const diff = {
      frontend: { addedEntities: ['newEntity'], removedEntities: [], entityDiffs: {
        order: { added: [], removed: [{ name: 'price' }], changed: [
          { name: 'notes', properties: [{ property: 'grid', from: true, to: false }] }
        ]}
      }},
      backend: { addedEntities: [], removedEntities: [], entityDiffs: {} },
      endpoints: { added: [], removed: [] },
    };
    const result = classifyChanges(diff);
    // field removal (breaking) + entity addition (additive) + grid change (patch) = breaking wins
    assert.equal(result.level, 'breaking');
  });
});

// --- bumpVersion + buildChangelogEntry ---

describe('bumpVersion', () => {
  it('bumps patch version', () => {
    assert.equal(bumpVersion('0.1.0', 'patch'), '0.1.1');
    assert.equal(bumpVersion('1.2.3', 'patch'), '1.2.4');
  });

  it('bumps minor version and resets patch', () => {
    assert.equal(bumpVersion('0.1.2', 'additive'), '0.2.0');
    assert.equal(bumpVersion('1.3.5', 'additive'), '1.4.0');
  });

  it('bumps minor for breaking pre-1.0', () => {
    assert.equal(bumpVersion('0.1.0', 'breaking'), '0.2.0');
    assert.equal(bumpVersion('0.5.3', 'breaking'), '0.6.0');
  });

  it('bumps major for breaking post-1.0', () => {
    assert.equal(bumpVersion('1.0.0', 'breaking'), '2.0.0');
    assert.equal(bumpVersion('2.3.1', 'breaking'), '3.0.0');
  });
});

describe('buildChangelogEntry', () => {
  it('creates a changelog entry with all required fields', () => {
    const classification = {
      level: 'additive',
      reasons: ['Field "discount" added to entity "order"'],
    };
    const entry = buildChangelogEntry('0.1.0', '0.2.0', classification, 'catalyst');
    assert.equal(entry.from, '0.1.0');
    assert.equal(entry.to, '0.2.0');
    assert.equal(entry.level, 'additive');
    assert.deepEqual(entry.reasons, ['Field "discount" added to entity "order"']);
    assert.equal(entry.author, 'catalyst');
    assert.ok(entry.date);
    // date should be ISO format
    assert.ok(entry.date.match(/^\d{4}-\d{2}-\d{2}/));
  });

  it('defaults author to "system" when not provided', () => {
    const classification = { level: 'patch', reasons: ['grid change'] };
    const entry = buildChangelogEntry('0.1.0', '0.1.1', classification);
    assert.equal(entry.author, 'system');
  });
});

// --- checkVersion integration ---

describe('checkVersion (integration)', () => {
  const testWindow = '_test-check-version';
  const artifactDir = join(ROOT, 'artifacts', testWindow);

  beforeEach(async () => {
    await mkdir(artifactDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(artifactDir, { recursive: true, force: true });
  });

  it('returns null when no prev contract exists', async () => {
    const contract = makeContract(
      { order: { fields: [{ name: 'documentNo', type: 'string' }] } },
      [{ method: 'GET', path: '/order' }]
    );
    await writeFile(join(artifactDir, 'contract.json'), JSON.stringify(contract, null, 2));
    const result = await checkVersion(testWindow, 'test-author');
    assert.equal(result, null);
  });

  it('detects additive change and updates version', async () => {
    const oldContract = makeContract(
      { order: { fields: [{ name: 'documentNo', type: 'string' }] } },
      [{ method: 'GET', path: '/order' }]
    );
    const newContract = makeContract(
      { order: { fields: [
        { name: 'documentNo', type: 'string' },
        { name: 'dateOrdered', type: 'date' },
      ] } },
      [{ method: 'GET', path: '/order' }]
    );
    await writeFile(join(artifactDir, 'contract.prev.json'), JSON.stringify(oldContract, null, 2));
    await writeFile(join(artifactDir, 'contract.json'), JSON.stringify(newContract, null, 2));

    const result = await checkVersion(testWindow, 'test-author');
    assert.notEqual(result, null);
    assert.equal(result.level, 'additive');
    assert.equal(result.newVersion, '0.2.0');

    // Verify contract.json was updated with new version
    const { readFile } = await import('node:fs/promises');
    const updated = JSON.parse(await readFile(join(artifactDir, 'contract.json'), 'utf-8'));
    assert.equal(updated.version, '0.2.0');

    // Verify changelog was written
    const changelog = JSON.parse(await readFile(join(artifactDir, 'contract-changelog.json'), 'utf-8'));
    assert.ok(Array.isArray(changelog));
    assert.equal(changelog.length, 1);
    assert.equal(changelog[0].from, '0.1.0');
    assert.equal(changelog[0].to, '0.2.0');
    assert.equal(changelog[0].author, 'test-author');
  });
});

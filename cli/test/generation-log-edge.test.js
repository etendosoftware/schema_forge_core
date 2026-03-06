import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  parseFieldArray,
  classifyFile,
  compareGenerated,
  createLogEntries,
  appendToLog,
  generateWindowView,
  generateRunsView,
} from '../src/generation-log.js';

const TMP = resolve(import.meta.dirname, '../../.tmp-gen-log-edge-test');

function setup() {
  rmSync(TMP, { recursive: true, force: true });
  mkdirSync(TMP, { recursive: true });
}

function teardown() {
  rmSync(TMP, { recursive: true, force: true });
}

// --- parseFieldArray edge cases ---

describe('parseFieldArray edge cases', () => {
  it('handles empty array body', () => {
    const source = 'const columns = [];';
    const fields = parseFieldArray(source, 'columns');
    assert.equal(fields.length, 0);
  });

  it('handles fields with numeric values', () => {
    const source = `const columns = [
  { key: 'weight', label: 'Weight', type: 'number', width: 120 },
];`;
    const fields = parseFieldArray(source, 'columns');
    assert.equal(fields.length, 1);
    assert.equal(fields[0].width, '120');
  });

  it('handles double-quoted values', () => {
    const source = `const columns = [
  { key: "name", label: "Name", type: "string" },
];`;
    const fields = parseFieldArray(source, 'columns');
    assert.equal(fields.length, 1);
    assert.equal(fields[0].key, 'name');
  });

  it('skips objects without a key property', () => {
    const source = `const columns = [
  { label: 'NoKey', type: 'string' },
  { key: 'valid', label: 'Valid', type: 'string' },
];`;
    const fields = parseFieldArray(source, 'columns');
    assert.equal(fields.length, 1);
    assert.equal(fields[0].key, 'valid');
  });

  it('handles source with multiple array definitions', () => {
    const source = `const columns = [
  { key: 'col1', label: 'Col 1', type: 'string' },
];
const fields = [
  { key: 'f1', label: 'Field 1', type: 'text' },
];`;
    const columns = parseFieldArray(source, 'columns');
    const fields = parseFieldArray(source, 'fields');
    assert.equal(columns.length, 1);
    assert.equal(columns[0].key, 'col1');
    assert.equal(fields.length, 1);
    assert.equal(fields[0].key, 'f1');
  });
});

// --- classifyFile edge cases ---

describe('classifyFile edge cases', () => {
  it('handles files with Table in middle of name', () => {
    assert.equal(classifyFile('MyTableHelper.jsx'), 'other');
  });

  it('handles .js extension', () => {
    assert.equal(classifyFile('mockCatalogs.js'), 'other');
  });

  it('handles index.js (not .jsx)', () => {
    // Only index.jsx is classified as 'index', index.js is 'other'
    assert.equal(classifyFile('index.js'), 'other');
  });
});

// --- compareGenerated edge cases ---

describe('compareGenerated edge cases', () => {
  it('handles both old and new being empty', () => {
    const changes = compareGenerated('test', {}, {});
    assert.equal(changes.length, 0);
  });

  it('handles multiple simultaneous changes across files', () => {
    const oldFiles = {
      'OrderTable.jsx': `const columns = [
  { key: 'name', label: 'Name', type: 'string' },
];`,
      'OrderForm.jsx': `const fields = [
  { key: 'name', label: 'Name', type: 'text' },
];`,
    };
    const newFiles = {
      'OrderTable.jsx': `const columns = [
  { key: 'name', label: 'Name', type: 'string' },
  { key: 'status', label: 'Status', type: 'status' },
];`,
      'OrderForm.jsx': `const fields = [
  { key: 'description', label: 'Description', type: 'text' },
];`,
    };
    const changes = compareGenerated('sales-order', oldFiles, newFiles);
    // Table: field-added (status), Form: field-removed (name) + field-added (description)
    assert.ok(changes.length >= 3);
    const changeTypes = changes.map(c => c.change);
    assert.ok(changeTypes.includes('field-added'));
    assert.ok(changeTypes.includes('field-removed'));
  });

  it('detects component-changed for table when columns stay same but code differs', () => {
    const oldContent = `const columns = [
  { key: 'name', label: 'Name', type: 'string' },
];
// old comment`;
    const newContent = `const columns = [
  { key: 'name', label: 'Name', type: 'string' },
];
// new comment`;
    const changes = compareGenerated('warehouse', { 'WarehouseTable.jsx': oldContent }, { 'WarehouseTable.jsx': newContent });
    assert.equal(changes.length, 1);
    assert.equal(changes[0].change, 'component-changed');
    assert.equal(changes[0].after, 'table structure changed');
  });

  it('detects component-changed for form when fields stay same but code differs', () => {
    const oldContent = `const fields = [
  { key: 'name', label: 'Name', type: 'text' },
];
// old`;
    const newContent = `const fields = [
  { key: 'name', label: 'Name', type: 'text' },
];
// new`;
    const changes = compareGenerated('warehouse', { 'WarehouseForm.jsx': oldContent }, { 'WarehouseForm.jsx': newContent });
    assert.equal(changes.length, 1);
    assert.equal(changes[0].change, 'component-changed');
    assert.equal(changes[0].after, 'form structure changed');
  });

  it('detects index file changes', () => {
    const changes = compareGenerated('test', { 'index.jsx': 'old' }, { 'index.jsx': 'new' });
    assert.equal(changes.length, 1);
    assert.equal(changes[0].change, 'component-changed');
    assert.ok(changes[0].after.includes('index'));
  });

  it('entity extraction works for multi-word filenames', () => {
    const changes = compareGenerated('test', {}, { 'BusinessPartnerTable.jsx': 'content' });
    assert.equal(changes.length, 1);
    assert.equal(changes[0].entity, 'businessPartner');
  });

  it('handles file-removed correctly', () => {
    const changes = compareGenerated('test', { 'OldFile.jsx': 'some content of 30 bytes' }, {});
    assert.equal(changes.length, 1);
    assert.equal(changes[0].change, 'file-removed');
    assert.ok(changes[0].before.includes('bytes'));
    assert.equal(changes[0].after, null);
  });
});

// --- createLogEntries edge cases ---

describe('createLogEntries edge cases', () => {
  it('handles existing log with non-sequential runIds', () => {
    const existingLog = [
      { runId: 'run-003' },
      { runId: 'run-001' },
      { runId: 'run-010' },
    ];
    const entries = createLogEntries('w', 'test', {}, { 'X.jsx': 'new' }, existingLog);
    assert.equal(entries[0].runId, 'run-011');
  });

  it('handles existing log with invalid runId entries', () => {
    const existingLog = [
      { runId: 'run-002' },
      { runId: 'invalid' },
      { runId: null },
    ];
    const entries = createLogEntries('w', 'test', {}, { 'X.jsx': 'new' }, existingLog);
    assert.equal(entries[0].runId, 'run-003');
  });

  it('pads runId to 3 digits', () => {
    const entries = createLogEntries('w', 'test', {}, { 'X.jsx': 'new' }, []);
    assert.match(entries[0].runId, /^run-\d{3}$/);
  });

  it('run timestamp is valid ISO string', () => {
    const entries = createLogEntries('w', 'test', {}, { 'X.jsx': 'new' }, []);
    const date = new Date(entries[0].run);
    assert.ok(!isNaN(date.getTime()));
  });

  it('multiple changes in same run share runId and timestamp', () => {
    const oldFiles = {};
    const newFiles = {
      'ATable.jsx': 'content1',
      'BForm.jsx': 'content2',
    };
    const entries = createLogEntries('w', 'test', oldFiles, newFiles, []);
    assert.ok(entries.length >= 2);
    const runIds = new Set(entries.map(e => e.runId));
    assert.equal(runIds.size, 1);
    const timestamps = new Set(entries.map(e => e.run));
    assert.equal(timestamps.size, 1);
  });
});

// --- appendToLog edge cases ---

describe('appendToLog edge cases', () => {
  it('handles corrupted JSON file gracefully', () => {
    setup();
    const logPath = resolve(TMP, 'corrupt.json');
    writeFileSync(logPath, '{not valid json!!!', 'utf-8');
    appendToLog([{ runId: 'run-001' }], logPath);
    const data = JSON.parse(readFileSync(logPath, 'utf-8'));
    assert.equal(data.length, 1);
    assert.equal(data[0].runId, 'run-001');
    teardown();
  });

  it('creates nested directories if needed', () => {
    setup();
    const logPath = resolve(TMP, 'deep/nested/dir/log.json');
    appendToLog([{ runId: 'run-001' }], logPath);
    const data = JSON.parse(readFileSync(logPath, 'utf-8'));
    assert.equal(data.length, 1);
    teardown();
  });

  it('handles empty entries array', () => {
    setup();
    const logPath = resolve(TMP, 'log.json');
    writeFileSync(logPath, JSON.stringify([{ runId: 'run-001' }]), 'utf-8');
    appendToLog([], logPath);
    const data = JSON.parse(readFileSync(logPath, 'utf-8'));
    assert.equal(data.length, 1); // unchanged
    teardown();
  });
});

// --- generateWindowView edge cases ---

describe('generateWindowView edge cases', () => {
  it('handles missing log file', () => {
    setup();
    const logPath = resolve(TMP, 'nonexistent.json');
    const outPath = resolve(TMP, 'out.md');
    // Should not throw, should write "No changes recorded"
    generateWindowView('warehouse', logPath, outPath);
    const md = readFileSync(outPath, 'utf-8');
    assert.ok(md.includes('No changes recorded'));
    teardown();
  });

  it('filters entries to only requested window', () => {
    setup();
    const logPath = resolve(TMP, 'log.json');
    const outPath = resolve(TMP, 'out.md');
    const entries = [
      { run: '2026-03-06T10:00:00.000Z', runId: 'run-001', trigger: 'test', window: 'warehouse', entity: 'w', field: null, file: 'W.jsx', change: 'new-file', before: null, after: '10 bytes' },
      { run: '2026-03-06T10:00:00.000Z', runId: 'run-001', trigger: 'test', window: 'sales-order', entity: 's', field: null, file: 'S.jsx', change: 'new-file', before: null, after: '20 bytes' },
    ];
    writeFileSync(logPath, JSON.stringify(entries), 'utf-8');
    generateWindowView('warehouse', logPath, outPath);
    const md = readFileSync(outPath, 'utf-8');
    assert.ok(md.includes('warehouse'));
    assert.ok(!md.includes('sales-order'));
    teardown();
  });

  it('renders null before/after as dash', () => {
    setup();
    const logPath = resolve(TMP, 'log.json');
    const outPath = resolve(TMP, 'out.md');
    const entries = [{
      run: '2026-03-06T10:00:00.000Z', runId: 'run-001', trigger: 'test',
      window: 'warehouse', entity: 'w', field: null, file: 'W.jsx',
      change: 'new-file', before: null, after: '10 bytes',
    }];
    writeFileSync(logPath, JSON.stringify(entries), 'utf-8');
    generateWindowView('warehouse', logPath, outPath);
    const md = readFileSync(outPath, 'utf-8');
    // Null field and null before should be rendered as '-'
    assert.ok(md.includes('| - |'));
    teardown();
  });
});

// --- generateRunsView edge cases ---

describe('generateRunsView edge cases', () => {
  it('handles missing log file', () => {
    setup();
    const logPath = resolve(TMP, 'nonexistent.json');
    const outPath = resolve(TMP, 'runs.md');
    generateRunsView(logPath, outPath);
    const md = readFileSync(outPath, 'utf-8');
    assert.ok(md.includes('No runs recorded'));
    teardown();
  });

  it('groups multiple entries under same runId', () => {
    setup();
    const logPath = resolve(TMP, 'log.json');
    const outPath = resolve(TMP, 'runs.md');
    const entries = [
      { run: '2026-03-06T10:00:00.000Z', runId: 'run-001', trigger: 'test', window: 'warehouse', entity: 'w', field: 'a', file: 'W.jsx', change: 'field-added', before: null, after: 'column: string' },
      { run: '2026-03-06T10:00:00.000Z', runId: 'run-001', trigger: 'test', window: 'warehouse', entity: 'w', field: 'b', file: 'W.jsx', change: 'field-removed', before: 'column: string', after: null },
    ];
    writeFileSync(logPath, JSON.stringify(entries), 'utf-8');
    generateRunsView(logPath, outPath);
    const md = readFileSync(outPath, 'utf-8');
    // Should have only one ## run-001 heading
    const headingCount = (md.match(/## run-001/g) || []).length;
    assert.equal(headingCount, 1);
    // Should list both change types in summary
    assert.ok(md.includes('field-added'));
    assert.ok(md.includes('field-removed'));
    teardown();
  });

  it('lists multiple windows in run summary', () => {
    setup();
    const logPath = resolve(TMP, 'log.json');
    const outPath = resolve(TMP, 'runs.md');
    const entries = [
      { run: '2026-03-06T10:00:00.000Z', runId: 'run-001', trigger: 'test', window: 'warehouse', entity: 'w', field: null, file: 'W.jsx', change: 'new-file', before: null, after: '10 bytes' },
      { run: '2026-03-06T10:00:00.000Z', runId: 'run-001', trigger: 'test', window: 'sales-order', entity: 'o', field: null, file: 'O.jsx', change: 'new-file', before: null, after: '20 bytes' },
    ];
    writeFileSync(logPath, JSON.stringify(entries), 'utf-8');
    generateRunsView(logPath, outPath);
    const md = readFileSync(outPath, 'utf-8');
    assert.ok(md.includes('warehouse, sales-order'));
    teardown();
  });
});

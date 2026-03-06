import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
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

const TMP = resolve(import.meta.dirname, '../../.tmp-gen-log-test');

function setup() {
  rmSync(TMP, { recursive: true, force: true });
  mkdirSync(TMP, { recursive: true });
}

function teardown() {
  rmSync(TMP, { recursive: true, force: true });
}

// --- parseFieldArray ---

describe('parseFieldArray', () => {
  it('parses columns array from table JSX', () => {
    const source = `const columns = [
  { key: 'name', label: 'Name', type: 'string' },
  { key: 'isActive', label: 'Is Active', type: 'boolean' },
];`;
    const fields = parseFieldArray(source, 'columns');
    assert.equal(fields.length, 2);
    assert.equal(fields[0].key, 'name');
    assert.equal(fields[0].type, 'string');
    assert.equal(fields[1].key, 'isActive');
    assert.equal(fields[1].type, 'boolean');
  });

  it('parses fields array from form JSX', () => {
    const source = `const fields = [
  { key: 'name', label: 'Name', type: 'text', required: 'true' },
  { key: 'description', label: 'Description', type: 'text' },
];`;
    const fields = parseFieldArray(source, 'fields');
    assert.equal(fields.length, 2);
    assert.equal(fields[0].required, 'true');
    assert.equal(fields[1].key, 'description');
  });

  it('returns empty array when array name not found', () => {
    const fields = parseFieldArray('const foo = "bar";', 'columns');
    assert.equal(fields.length, 0);
  });
});

// --- classifyFile ---

describe('classifyFile', () => {
  it('classifies table files', () => {
    assert.equal(classifyFile('OrderTable.jsx'), 'table');
  });
  it('classifies form files', () => {
    assert.equal(classifyFile('OrderForm.jsx'), 'form');
  });
  it('classifies page files', () => {
    assert.equal(classifyFile('OrderPage.jsx'), 'page');
  });
  it('classifies index files', () => {
    assert.equal(classifyFile('index.jsx'), 'index');
  });
  it('classifies other files', () => {
    assert.equal(classifyFile('mockCatalogs.js'), 'other');
  });
});

// --- compareGenerated ---

describe('compareGenerated', () => {
  it('detects new files', () => {
    const oldFiles = {};
    const newFiles = { 'OrderTable.jsx': 'const columns = [];' };
    const changes = compareGenerated('sales-order', oldFiles, newFiles);
    assert.equal(changes.length, 1);
    assert.equal(changes[0].change, 'new-file');
    assert.equal(changes[0].file, 'OrderTable.jsx');
  });

  it('detects removed files', () => {
    const oldFiles = { 'OrderTable.jsx': 'const columns = [];' };
    const newFiles = {};
    const changes = compareGenerated('sales-order', oldFiles, newFiles);
    assert.equal(changes.length, 1);
    assert.equal(changes[0].change, 'file-removed');
  });

  it('detects field type changes in table', () => {
    const oldContent = `import { DataTable } from '@/components/contract-ui';
const columns = [
  { key: 'name', label: 'Name', type: 'string' },
  { key: 'amount', label: 'Amount', type: 'string' },
];`;
    const newContent = `import { DataTable } from '@/components/contract-ui';
const columns = [
  { key: 'name', label: 'Name', type: 'string' },
  { key: 'amount', label: 'Amount', type: 'amount' },
];`;
    const changes = compareGenerated('warehouse', { 'WarehouseTable.jsx': oldContent }, { 'WarehouseTable.jsx': newContent });
    assert.equal(changes.length, 1);
    assert.equal(changes[0].change, 'field-type');
    assert.equal(changes[0].field, 'amount');
    assert.equal(changes[0].before, 'string');
    assert.equal(changes[0].after, 'amount');
  });

  it('detects field additions in form', () => {
    const oldContent = `const fields = [
  { key: 'name', label: 'Name', type: 'text' },
];`;
    const newContent = `const fields = [
  { key: 'name', label: 'Name', type: 'text' },
  { key: 'description', label: 'Description', type: 'text' },
];`;
    const changes = compareGenerated('warehouse', { 'WarehouseForm.jsx': oldContent }, { 'WarehouseForm.jsx': newContent });
    assert.equal(changes.length, 1);
    assert.equal(changes[0].change, 'field-added');
    assert.equal(changes[0].field, 'description');
  });

  it('detects field removals in table', () => {
    const oldContent = `const columns = [
  { key: 'name', label: 'Name', type: 'string' },
  { key: 'legacy', label: 'Legacy', type: 'string' },
];`;
    const newContent = `const columns = [
  { key: 'name', label: 'Name', type: 'string' },
];`;
    const changes = compareGenerated('warehouse', { 'WarehouseTable.jsx': oldContent }, { 'WarehouseTable.jsx': newContent });
    assert.equal(changes.length, 1);
    assert.equal(changes[0].change, 'field-removed');
    assert.equal(changes[0].field, 'legacy');
  });

  it('detects page content changes', () => {
    const changes = compareGenerated('sales-order',
      { 'OrderPage.jsx': 'old content' },
      { 'OrderPage.jsx': 'new content' },
    );
    assert.equal(changes.length, 1);
    assert.equal(changes[0].change, 'component-changed');
  });

  it('ignores identical files', () => {
    const content = `const columns = [
  { key: 'name', label: 'Name', type: 'string' },
];`;
    const changes = compareGenerated('warehouse', { 'WarehouseTable.jsx': content }, { 'WarehouseTable.jsx': content });
    assert.equal(changes.length, 0);
  });
});

// --- createLogEntries ---

describe('createLogEntries', () => {
  it('creates entries with run metadata', () => {
    const oldFiles = {};
    const newFiles = { 'WarehouseTable.jsx': 'const columns = [];' };
    const entries = createLogEntries('warehouse', 'test trigger', oldFiles, newFiles, []);
    assert.equal(entries.length, 1);
    assert.equal(entries[0].runId, 'run-001');
    assert.equal(entries[0].trigger, 'test trigger');
    assert.equal(entries[0].window, 'warehouse');
    assert.ok(entries[0].run); // ISO timestamp
  });

  it('auto-increments runId from existing log', () => {
    const existingLog = [{ runId: 'run-005' }];
    const entries = createLogEntries('warehouse', 'test', {}, { 'X.jsx': 'new' }, existingLog);
    assert.equal(entries[0].runId, 'run-006');
  });

  it('returns single no-changes entry when no changes', () => {
    const content = 'same content';
    const entries = createLogEntries('w', 'test', { 'a.jsx': content }, { 'a.jsx': content }, []);
    assert.equal(entries.length, 1);
    assert.equal(entries[0].change, 'no-changes');
  });

  it('entry has all required fields', () => {
    const entries = createLogEntries('warehouse', 'trigger', {}, { 'New.jsx': 'x' }, []);
    const e = entries[0];
    const requiredKeys = ['run', 'runId', 'trigger', 'window', 'entity', 'field', 'file', 'change', 'before', 'after'];
    for (const key of requiredKeys) {
      assert.ok(key in e, `missing key: ${key}`);
    }
  });
});

// --- createLogEntries no-changes ---

describe('createLogEntries no-changes', () => {
  it('returns a single no-changes entry when old and new files are identical', () => {
    const oldFiles = { 'OrderTable.jsx': 'const x = 1;' };
    const newFiles = { 'OrderTable.jsx': 'const x = 1;' };
    const existingLog = [{ runId: 'run-005' }];
    const entries = createLogEntries('sales-order', 'verify-test', oldFiles, newFiles, existingLog);

    assert.equal(entries.length, 1);
    const entry = entries[0];
    assert.equal(entry.change, 'no-changes');
    assert.equal(entry.window, 'sales-order');
    assert.equal(entry.trigger, 'verify-test');
    assert.equal(entry.runId, 'run-006');
    assert.equal(entry.entity, null);
    assert.equal(entry.field, null);
    assert.equal(entry.file, null);
    assert.equal(entry.before, null);
    assert.equal(entry.after, null);
    assert.ok(entry.run); // ISO timestamp present
  });
});

// --- appendToLog ---

describe('appendToLog', () => {
  it('creates file if missing', () => {
    setup();
    const logPath = resolve(TMP, 'log.json');
    appendToLog([{ runId: 'run-001' }], logPath);
    const data = JSON.parse(readFileSync(logPath, 'utf-8'));
    assert.equal(data.length, 1);
    teardown();
  });

  it('appends to existing file', () => {
    setup();
    const logPath = resolve(TMP, 'log.json');
    writeFileSync(logPath, JSON.stringify([{ runId: 'run-001' }]), 'utf-8');
    appendToLog([{ runId: 'run-002' }], logPath);
    const data = JSON.parse(readFileSync(logPath, 'utf-8'));
    assert.equal(data.length, 2);
    assert.equal(data[1].runId, 'run-002');
    teardown();
  });
});

// --- generateWindowView ---

describe('generateWindowView', () => {
  it('produces valid markdown with table', () => {
    setup();
    const logPath = resolve(TMP, 'log.json');
    const outPath = resolve(TMP, 'GENERATION-LOG.md');
    const entries = [{
      run: '2026-03-06T10:00:00.000Z',
      runId: 'run-001',
      trigger: 'test',
      window: 'warehouse',
      entity: 'warehouse',
      field: 'description',
      file: 'WarehouseForm.jsx',
      change: 'field-added',
      before: null,
      after: 'form: text',
    }];
    writeFileSync(logPath, JSON.stringify(entries), 'utf-8');
    generateWindowView('warehouse', logPath, outPath);
    const md = readFileSync(outPath, 'utf-8');
    assert.ok(md.includes('# Generation Log: warehouse'));
    assert.ok(md.includes('run-001'));
    assert.ok(md.includes('field-added'));
    assert.ok(md.includes('| File |'));
    teardown();
  });

  it('handles empty log gracefully', () => {
    setup();
    const logPath = resolve(TMP, 'log.json');
    const outPath = resolve(TMP, 'GENERATION-LOG.md');
    writeFileSync(logPath, '[]', 'utf-8');
    generateWindowView('warehouse', logPath, outPath);
    const md = readFileSync(outPath, 'utf-8');
    assert.ok(md.includes('No changes recorded'));
    teardown();
  });
});

// --- generateRunsView ---

describe('generateRunsView', () => {
  it('produces valid markdown grouped by run', () => {
    setup();
    const logPath = resolve(TMP, 'log.json');
    const outPath = resolve(TMP, 'GENERATION-RUNS.md');
    const entries = [
      {
        run: '2026-03-06T10:00:00.000Z', runId: 'run-001', trigger: 'test1',
        window: 'warehouse', entity: 'warehouse', field: 'name',
        file: 'WarehouseTable.jsx', change: 'field-type', before: 'string', after: 'text',
      },
      {
        run: '2026-03-06T11:00:00.000Z', runId: 'run-002', trigger: 'test2',
        window: 'sales-order', entity: 'order', field: null,
        file: 'OrderTable.jsx', change: 'new-file', before: null, after: '200 bytes',
      },
    ];
    writeFileSync(logPath, JSON.stringify(entries), 'utf-8');
    generateRunsView(logPath, outPath);
    const md = readFileSync(outPath, 'utf-8');
    assert.ok(md.includes('# Generation Runs'));
    assert.ok(md.includes('run-001'));
    assert.ok(md.includes('run-002'));
    assert.ok(md.includes('warehouse'));
    assert.ok(md.includes('sales-order'));
    assert.ok(md.includes('| Window |'));
    teardown();
  });

  it('handles empty log gracefully', () => {
    setup();
    const logPath = resolve(TMP, 'log.json');
    const outPath = resolve(TMP, 'GENERATION-RUNS.md');
    writeFileSync(logPath, '[]', 'utf-8');
    generateRunsView(logPath, outPath);
    const md = readFileSync(outPath, 'utf-8');
    assert.ok(md.includes('No runs recorded'));
    teardown();
  });
});

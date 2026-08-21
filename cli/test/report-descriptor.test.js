import { describe, it, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// ETP-4899: exercises the REAL shared module. The bug this file guards against
// slipped through precisely because the old test re-implemented the filter and
// the output shape inline — a hand-built object literal passes whether or not
// the production code carries `sections`. Never re-implement the logic here;
// always import it.
import {
  VALID_SOURCES,
  isListableReport,
  buildReportDescriptor,
  listReportDescriptors,
} from '../src/report-descriptor.js';

/**
 * The exact key set the frontend consumes off `GET /api/reports`. Pinned so
 * that adding or removing a descriptor field is a deliberate act: the report
 * viewer has no other source for these, and dropping one (as happened with
 * `sections`) degrades the UI silently instead of erroring.
 */
const EXPECTED_KEYS = [
  'category',
  'id',
  'orientation',
  'outputs',
  'parameters',
  'sections',
  'title',
  'type',
];

function contract(overrides = {}) {
  return {
    reportId: 'R001',
    title: 'Test Report',
    type: 'listing',
    source: 'manual',
    outputs: ['pdf'],
    ...overrides,
  };
}

describe('buildReportDescriptor — output shape', () => {
  it('emits exactly the expected key set (pinned on purpose)', () => {
    const keys = Object.keys(buildReportDescriptor(contract())).sort();
    assert.deepEqual(
      keys,
      EXPECTED_KEYS,
      'the descriptor key set changed — if this is intentional, update EXPECTED_KEYS ' +
        'and make sure every consumer of GET /api/reports handles the new shape'
    );
  });

  it('always carries `sections` (the ETP-4899 regression)', () => {
    const descriptor = buildReportDescriptor(contract());
    assert.ok(
      Object.hasOwn(descriptor, 'sections'),
      'descriptor lost `sections` — ReportViewerPage derives `useAccordion` from it, so ' +
        'omitting it silently downgrades every sectioned report to the legacy flat sidebar'
    );
  });

  it('maps contract.reportId onto id and passes the plain fields through', () => {
    const descriptor = buildReportDescriptor(
      contract({
        reportId: 'R005',
        title: 'Shaped Report',
        type: 'grouped-listing',
        source: 'sql',
        outputs: ['pdf', 'xlsx'],
        category: 'sales',
        orientation: 'portrait',
        parameters: [{ name: 'org', type: 'selector' }],
      })
    );
    assert.equal(descriptor.id, 'R005');
    assert.equal(descriptor.title, 'Shaped Report');
    assert.equal(descriptor.type, 'grouped-listing');
    assert.equal(descriptor.category, 'sales');
    assert.equal(descriptor.orientation, 'portrait');
    assert.deepEqual(descriptor.outputs, ['pdf', 'xlsx']);
    assert.deepEqual(descriptor.parameters, [{ name: 'org', type: 'selector' }]);
  });

  it('does not leak contract-only fields (source, mockDataFile, sql…)', () => {
    const descriptor = buildReportDescriptor(
      contract({ mockDataFile: 'mock.json', sql: 'SELECT 1', dataSource: 'neo' })
    );
    for (const leaked of ['source', 'mockDataFile', 'sql', 'dataSource']) {
      assert.ok(!Object.hasOwn(descriptor, leaked), `descriptor leaked contract field \`${leaked}\``);
    }
  });
});

describe('buildReportDescriptor — defaults', () => {
  it('defaults category to "other" when the contract omits it', () => {
    assert.equal(buildReportDescriptor(contract()).category, 'other');
  });

  it('defaults parameters to an empty array when the contract omits it', () => {
    assert.deepEqual(buildReportDescriptor(contract()).parameters, []);
  });

  it('defaults sections to an empty array when the contract omits it', () => {
    assert.deepEqual(buildReportDescriptor(contract()).sections, []);
  });

  it('leaves orientation undefined rather than inventing one', () => {
    assert.equal(buildReportDescriptor(contract()).orientation, undefined);
  });

  it('passes a real multi-section sections array straight through', () => {
    const sections = [
      { id: 'summary', title: 'Summary', columns: ['account', 'total'] },
      { id: 'detail', title: 'Detail', columns: ['date', 'debit', 'credit'] },
      { id: 'totals', title: 'Totals' },
    ];
    const descriptor = buildReportDescriptor(contract({ sections }));
    assert.deepEqual(
      descriptor.sections,
      sections,
      'sections must reach the frontend verbatim — it drives the accordion sidebar'
    );
    assert.equal(descriptor.sections.length, 3);
  });
});

describe('isListableReport', () => {
  it('exposes the four valid sources and nothing else', () => {
    assert.deepEqual(
      [...VALID_SOURCES].sort(),
      ['jasper-migration', 'manual', 'neo', 'sql']
    );
  });

  for (const source of ['jasper-migration', 'manual', 'sql', 'neo']) {
    it(`accepts a contract with source="${source}"`, () => {
      assert.equal(isListableReport(contract({ source })), true);
    });
  }

  it('accepts an unknown source when mockDataFile is present', () => {
    assert.equal(
      isListableReport(contract({ source: 'unknown', mockDataFile: 'mock.json' })),
      true
    );
  });

  it('rejects an unknown source with no mockDataFile', () => {
    assert.equal(isListableReport(contract({ source: 'unknown' })), false);
  });

  it('rejects a contract with no source at all', () => {
    const { source: _drop, ...rest } = contract();
    assert.equal(isListableReport(rest), false);
  });

  it('rejects a contract without reportId', () => {
    const { reportId: _drop, ...rest } = contract();
    assert.equal(isListableReport(rest), false);
  });

  it('rejects a contract with an empty outputs array', () => {
    assert.equal(isListableReport(contract({ outputs: [] })), false);
  });

  it('rejects a contract with no outputs key', () => {
    const { outputs: _drop, ...rest } = contract();
    assert.equal(isListableReport(rest), false);
  });

  it('rejects type="document" (documents print from their own window)', () => {
    assert.equal(isListableReport(contract({ type: 'document' })), false);
  });

  it('rejects null/undefined without throwing', () => {
    assert.equal(isListableReport(null), false);
    assert.equal(isListableReport(undefined), false);
  });
});

describe('listReportDescriptors', () => {
  let artifactsDir;

  const write = (name, body) => {
    const dir = join(artifactsDir, name);
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, 'report-contract.json'),
      typeof body === 'string' ? body : JSON.stringify(body)
    );
  };

  beforeEach(() => {
    artifactsDir = mkdtempSync(join(tmpdir(), 'report-descriptor-'));
  });

  afterEach(() => {
    rmSync(artifactsDir, { recursive: true, force: true });
  });

  it('returns an empty list for an empty artifacts dir', () => {
    assert.deepEqual(listReportDescriptors(artifactsDir), []);
  });

  it('picks up every listable contract, keyed by reportId', () => {
    write('alpha', contract({ reportId: 'alpha' }));
    write('beta', contract({ reportId: 'beta', source: 'sql' }));
    const ids = listReportDescriptors(artifactsDir).map((r) => r.id).sort();
    assert.deepEqual(ids, ['alpha', 'beta']);
  });

  it('carries sections through from the contract on disk', () => {
    const sections = [{ id: 'assets', title: 'Assets' }, { id: 'liabilities', title: 'Liabilities' }];
    write('balance-sheet', contract({ reportId: 'balance-sheet', sections }));
    const [descriptor] = listReportDescriptors(artifactsDir);
    assert.deepEqual(
      descriptor.sections,
      sections,
      'sections were dropped between the contract file and the descriptor — ' +
        'this is the exact ETP-4899 production bug'
    );
  });

  it('defaults sections to [] for a contract that declares none', () => {
    write('flat', contract({ reportId: 'flat' }));
    assert.deepEqual(listReportDescriptors(artifactsDir)[0].sections, []);
  });

  it('skips a directory with no report-contract.json', () => {
    mkdirSync(join(artifactsDir, 'not-a-report'), { recursive: true });
    write('alpha', contract({ reportId: 'alpha' }));
    assert.deepEqual(listReportDescriptors(artifactsDir).map((r) => r.id), ['alpha']);
  });

  it('skips malformed JSON without throwing', () => {
    write('broken', '{ this is not json');
    write('alpha', contract({ reportId: 'alpha' }));
    let result;
    assert.doesNotThrow(() => {
      result = listReportDescriptors(artifactsDir);
    });
    assert.deepEqual(result.map((r) => r.id), ['alpha']);
  });

  it('skips non-listable contracts (document / no outputs / bad source)', () => {
    write('doc', contract({ reportId: 'doc', type: 'document' }));
    write('empty', contract({ reportId: 'empty', outputs: [] }));
    write('bad-source', contract({ reportId: 'bad-source', source: 'nope' }));
    write('alpha', contract({ reportId: 'alpha' }));
    assert.deepEqual(listReportDescriptors(artifactsDir).map((r) => r.id), ['alpha']);
  });

  it('ignores plain files sitting directly in the artifacts dir', () => {
    writeFileSync(join(artifactsDir, 'README.md'), '# not a report');
    write('alpha', contract({ reportId: 'alpha' }));
    assert.deepEqual(listReportDescriptors(artifactsDir).map((r) => r.id), ['alpha']);
  });

  it('every returned descriptor has the pinned key set', () => {
    write('alpha', contract({ reportId: 'alpha', sections: [{ id: 's' }] }));
    write('beta', contract({ reportId: 'beta', source: 'neo' }));
    for (const descriptor of listReportDescriptors(artifactsDir)) {
      assert.deepEqual(Object.keys(descriptor).sort(), EXPECTED_KEYS);
    }
  });
});

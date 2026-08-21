import { describe, it, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(__dirname, '../src/generate-reports-manifest.js');

/**
 * ETP-4899: this suite used to simulate the script's filter and output shape
 * with inline object literals, which meant it stayed green while the real
 * script silently dropped `sections` from every report on every server. It now
 * EXECUTES the script against a temp SF_ROOT and asserts the JSON it actually
 * writes. Shape/filter unit coverage of the shared module lives in
 * report-descriptor.test.js — this file only covers what is specific to the
 * script: paths, output file, exit behaviour, end-to-end integration.
 */
describe('generate-reports-manifest (real execution)', () => {
  let tmpDir;
  let artifactsDir;
  let outFile;

  const writeContract = (name, body) => {
    const dir = join(artifactsDir, name);
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, 'report-contract.json'),
      typeof body === 'string' ? body : JSON.stringify(body)
    );
  };

  const run = () =>
    execFileSync(process.execPath, [SCRIPT], {
      env: { ...process.env, SF_ROOT: tmpDir },
      encoding: 'utf8',
    });

  const readManifest = () => JSON.parse(readFileSync(outFile, 'utf8'));

  const contract = (overrides = {}) => ({
    reportId: 'R001',
    title: 'Test Report',
    type: 'listing',
    source: 'manual',
    outputs: ['pdf'],
    ...overrides,
  });

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'gen-reports-'));
    artifactsDir = join(tmpDir, 'artifacts');
    outFile = join(tmpDir, 'tools', 'app-shell', 'dist', 'api', 'reports');
    mkdirSync(artifactsDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('writes the manifest to tools/app-shell/dist/api/reports, creating the dirs', () => {
    writeContract('alpha', contract({ reportId: 'alpha' }));
    const stdout = run();
    assert.ok(existsSync(outFile), `expected the manifest at ${outFile}`);
    assert.match(stdout, /reports manifest: 1 reports/);
    assert.deepEqual(readManifest().map((r) => r.id), ['alpha']);
  });

  it('writes an empty JSON array when there is nothing listable', () => {
    run();
    assert.deepEqual(readManifest(), []);
  });

  it('emits sections for every report — the ETP-4899 regression', () => {
    const sections = [
      { id: 'assets', title: 'Assets' },
      { id: 'liabilities', title: 'Liabilities' },
    ];
    writeContract('balance-sheet', contract({ reportId: 'balance-sheet', sections }));
    writeContract('flat', contract({ reportId: 'flat' }));
    run();

    const manifest = readManifest();
    for (const report of manifest) {
      assert.ok(
        Object.hasOwn(report, 'sections'),
        `report ${report.id} has no \`sections\` key — ReportViewerPage derives \`useAccordion\` ` +
          `from it, so the generated manifest would downgrade every sectioned report to the ` +
          `legacy flat sidebar in production`
      );
    }
    assert.deepEqual(manifest.find((r) => r.id === 'balance-sheet').sections, sections);
    assert.deepEqual(manifest.find((r) => r.id === 'flat').sections, []);
  });

  it('includes listable contracts and excludes the rest', () => {
    writeContract('inc-jasper', contract({ reportId: 'inc-jasper', source: 'jasper-migration' }));
    writeContract('inc-manual', contract({ reportId: 'inc-manual', source: 'manual' }));
    writeContract('inc-sql', contract({ reportId: 'inc-sql', source: 'sql' }));
    writeContract('inc-neo', contract({ reportId: 'inc-neo', source: 'neo' }));
    writeContract('inc-mock', contract({ reportId: 'inc-mock', source: 'weird', mockDataFile: 'm.json' }));
    writeContract('exc-document', contract({ reportId: 'exc-document', type: 'document' }));
    writeContract('exc-no-outputs', contract({ reportId: 'exc-no-outputs', outputs: [] }));
    writeContract('exc-bad-source', contract({ reportId: 'exc-bad-source', source: 'weird' }));
    writeContract('exc-no-id', { title: 'No ID', type: 'listing', source: 'manual', outputs: ['pdf'] });
    run();

    assert.deepEqual(
      readManifest().map((r) => r.id).sort(),
      ['inc-jasper', 'inc-manual', 'inc-mock', 'inc-neo', 'inc-sql']
    );
  });

  it('survives a malformed contract instead of failing the build', () => {
    writeContract('broken', '{ not json at all');
    writeContract('alpha', contract({ reportId: 'alpha' }));
    assert.doesNotThrow(run);
    assert.deepEqual(readManifest().map((r) => r.id), ['alpha']);
  });

  it('overwrites a stale manifest from a previous run', () => {
    writeContract('alpha', contract({ reportId: 'alpha' }));
    run();
    rmSync(join(artifactsDir, 'alpha'), { recursive: true, force: true });
    writeContract('beta', contract({ reportId: 'beta' }));
    run();
    assert.deepEqual(readManifest().map((r) => r.id), ['beta']);
  });

  it('produces the descriptor field set the frontend consumes', () => {
    writeContract(
      'shaped',
      contract({
        reportId: 'shaped',
        title: 'Shaped Report',
        type: 'grouped-listing',
        source: 'sql',
        outputs: ['pdf', 'xlsx'],
        category: 'sales',
        orientation: 'portrait',
        parameters: [{ name: 'org', type: 'selector' }],
      })
    );
    writeContract('defaults', contract({ reportId: 'defaults', source: 'neo' }));
    run();

    const manifest = readManifest();
    const shaped = manifest.find((r) => r.id === 'shaped');
    assert.deepEqual(Object.keys(shaped).sort(), [
      'category',
      'id',
      'orientation',
      'outputs',
      'parameters',
      'sections',
      'title',
      'type',
    ]);
    assert.equal(shaped.category, 'sales');
    assert.equal(shaped.orientation, 'portrait');
    assert.deepEqual(shaped.outputs, ['pdf', 'xlsx']);
    assert.equal(shaped.parameters.length, 1);

    const defaults = manifest.find((r) => r.id === 'defaults');
    assert.equal(defaults.category, 'other', 'category must default to "other"');
    assert.deepEqual(defaults.parameters, []);
    assert.deepEqual(defaults.sections, []);
  });

  it('writes a trailing newline (S3 upload / diff hygiene)', () => {
    writeContract('alpha', contract({ reportId: 'alpha' }));
    run();
    assert.ok(readFileSync(outFile, 'utf8').endsWith('\n'));
  });
});

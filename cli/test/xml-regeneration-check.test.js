import { describe, it, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { compareXmlFiles, main, parseXml } from '../src/xml-regeneration-check.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SCRIPT = join(__dirname, '..', 'src', 'xml-regeneration-check.js');

function createXmlFixture(dir, relPath, content) {
  const fullPath = join(dir, relPath);
  mkdirSync(dirname(fullPath), { recursive: true });
  writeFileSync(fullPath, content);
}

function runScript(originalDir, exportedDir, extraArgs = []) {
  try {
    const stdout = execFileSync('node', [SCRIPT, originalDir, exportedDir, ...extraArgs], {
      encoding: 'utf8',
    });
    return { exitCode: 0, stdout, stderr: '' };
  } catch (err) {
    return { exitCode: err.status, stdout: err.stdout || '', stderr: err.stderr || '' };
  }
}

function captureConsole(callback) {
  const stdout = [];
  const stderr = [];
  const originalLog = console.log;
  const originalError = console.error;
  console.log = (message = '') => stdout.push(String(message));
  console.error = (message = '') => stderr.push(String(message));
  try {
    return { exitCode: callback(), stdout: stdout.join('\n'), stderr: stderr.join('\n') };
  } finally {
    console.log = originalLog;
    console.error = originalError;
  }
}

describe('xml_regeneration_check', () => {
  let tmpDir;
  let originalDir;
  let exportedDir;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'xml-regen-check-'));
    originalDir = join(tmpDir, 'original');
    exportedDir = join(tmpDir, 'exported');
    mkdirSync(originalDir, { recursive: true });
    mkdirSync(exportedDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('exits 0 when directories are identical', () => {
    const xml = '<?xml version="1.0"?><table name="C_Order"><column name="DocumentNo"/></table>';
    createXmlFixture(originalDir, 'model/tables/C_Order.xml', xml);
    createXmlFixture(exportedDir, 'model/tables/C_Order.xml', xml);

    const result = runScript(originalDir, exportedDir);
    assert.equal(result.exitCode, 0);
    assert.ok(result.stdout.includes('Result: OK'));
  });

  it('compares matching files through the exported API', () => {
    const xml = '<?xml version="1.0"?><table name="C_Order"><column name="DocumentNo"/></table>';
    createXmlFixture(originalDir, 'model/tables/C_Order.xml', xml);
    createXmlFixture(exportedDir, 'model/tables/C_Order.xml', xml);

    const result = compareXmlFiles(originalDir, exportedDir, ['model/tables']);
    assert.deepEqual(result.ok, ['model/tables/C_Order.xml']);
    assert.deepEqual(result.changed, []);
    assert.deepEqual(result.missing, []);
    assert.deepEqual(result.extra, []);
    assert.deepEqual(result.errors, []);
  });

  it('returns 0 from main when directories match', () => {
    const xml = '<table name="C_Order"/>';
    createXmlFixture(originalDir, 'model/tables/C_Order.xml', xml);
    createXmlFixture(exportedDir, 'model/tables/C_Order.xml', xml);

    const result = captureConsole(() => main([originalDir, exportedDir]));
    assert.equal(result.exitCode, 0);
    assert.ok(result.stdout.includes('Result: OK'));
  });

  it('returns 2 from main when an input directory is invalid', () => {
    const result = captureConsole(() => main(['/nonexistent/path', exportedDir]));
    assert.equal(result.exitCode, 2);
    assert.ok(result.stderr.includes('original_dir'));
  });

  it('rejects DTD declarations through the parser API', () => {
    assert.throws(
      () => parseXml('<!DOCTYPE table [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><table/>'),
      /Unsafe XML declaration/,
    );
  });

  it('exits 0 when attributes are reordered', () => {
    const orig = '<?xml version="1.0"?><table name="C_Order" id="100"><column name="DocumentNo"/></table>';
    const exp = '<?xml version="1.0"?><table id="100" name="C_Order"><column name="DocumentNo"/></table>';
    createXmlFixture(originalDir, 'model/tables/C_Order.xml', orig);
    createXmlFixture(exportedDir, 'model/tables/C_Order.xml', exp);

    const result = runScript(originalDir, exportedDir);
    assert.equal(result.exitCode, 0);
  });

  it('exits 0 when child elements are reordered', () => {
    const orig = '<?xml version="1.0"?><table name="C_Order"><column name="B"/><column name="A"/></table>';
    const exp = '<?xml version="1.0"?><table name="C_Order"><column name="A"/><column name="B"/></table>';
    createXmlFixture(originalDir, 'model/tables/C_Order.xml', orig);
    createXmlFixture(exportedDir, 'model/tables/C_Order.xml', exp);

    const result = runScript(originalDir, exportedDir);
    assert.equal(result.exitCode, 0);
  });

  it('exits 1 when content differs', () => {
    const orig = '<?xml version="1.0"?><table name="C_Order"><column name="DocumentNo"/></table>';
    const exp = '<?xml version="1.0"?><table name="C_Order"><column name="DocNumber"/></table>';
    createXmlFixture(originalDir, 'model/tables/C_Order.xml', orig);
    createXmlFixture(exportedDir, 'model/tables/C_Order.xml', exp);

    const result = runScript(originalDir, exportedDir);
    assert.equal(result.exitCode, 1);
    assert.ok(result.stdout.includes('Changed files'));
  });

  it('exits 1 when a file is missing from export', () => {
    createXmlFixture(originalDir, 'model/tables/C_Order.xml', '<table name="C_Order"/>');

    const result = runScript(originalDir, exportedDir);
    assert.equal(result.exitCode, 1);
    assert.ok(result.stdout.includes('Missing from export'));
  });

  it('exits 1 when an extra file exists in export', () => {
    createXmlFixture(exportedDir, 'model/tables/C_Order.xml', '<table name="C_Order"/>');

    const result = runScript(originalDir, exportedDir);
    assert.equal(result.exitCode, 1);
    assert.ok(result.stdout.includes('Extra in export'));
  });

  it('exits 2 when original_dir is invalid', () => {
    const result = runScript('/nonexistent/path', exportedDir);
    assert.equal(result.exitCode, 2);
  });

  it('exits 2 when exported_dir is invalid', () => {
    const result = runScript(originalDir, '/nonexistent/path');
    assert.equal(result.exitCode, 2);
  });

  it('reports errors for invalid XML', () => {
    createXmlFixture(originalDir, 'model/tables/C_Order.xml', '<not valid xml');
    createXmlFixture(exportedDir, 'model/tables/C_Order.xml', '<table name="C_Order"/>');

    const result = runScript(originalDir, exportedDir);
    assert.ok(result.exitCode === 1 || result.exitCode === 2);
  });

  it('rejects XML with DTD declarations', () => {
    createXmlFixture(
      originalDir,
      'model/tables/C_Order.xml',
      '<!DOCTYPE table [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><table name="C_Order"/>',
    );
    createXmlFixture(exportedDir, 'model/tables/C_Order.xml', '<table name="C_Order"/>');

    const result = runScript(originalDir, exportedDir);
    assert.equal(result.exitCode, 1);
    assert.ok(result.stdout.includes('Unsafe XML declaration'));
  });

  it('supports JSON output format', () => {
    const xml = '<table name="C_Order"/>';
    createXmlFixture(originalDir, 'model/tables/C_Order.xml', xml);
    createXmlFixture(exportedDir, 'model/tables/C_Order.xml', xml);

    const result = runScript(originalDir, exportedDir, ['--format', 'json']);
    assert.equal(result.exitCode, 0);
    const report = JSON.parse(result.stdout);
    assert.equal(report.status, 'OK');
    assert.equal(report.summary.ok, 1);
  });

  it('supports --include-dir filtering', () => {
    createXmlFixture(originalDir, 'model/tables/C_Order.xml', '<table name="C_Order"/>');
    createXmlFixture(originalDir, 'sourcedata/AD_Table.xml', '<table name="AD_Table"/>');
    createXmlFixture(exportedDir, 'model/tables/C_Order.xml', '<table name="C_Order"/>');
    createXmlFixture(exportedDir, 'sourcedata/AD_Table.xml', '<table name="CHANGED"/>');

    // Without filter: both dirs compared, should fail
    const resultAll = runScript(originalDir, exportedDir);
    assert.equal(resultAll.exitCode, 1);

    // With filter: only model/tables, should pass
    const resultFiltered = runScript(originalDir, exportedDir, ['--include-dir', 'model/tables']);
    assert.equal(resultFiltered.exitCode, 0);
  });

  it('compares across multiple include directories by default', () => {
    createXmlFixture(originalDir, 'model/tables/C_Order.xml', '<table name="C_Order"/>');
    createXmlFixture(originalDir, 'model/functions/validate_order.xml', '<function name="validate"/>');
    createXmlFixture(originalDir, 'sourcedata/AD_Ref_List.xml', '<reflist name="test"/>');
    createXmlFixture(exportedDir, 'model/tables/C_Order.xml', '<table name="C_Order"/>');
    createXmlFixture(exportedDir, 'model/functions/validate_order.xml', '<function name="validate"/>');
    createXmlFixture(exportedDir, 'sourcedata/AD_Ref_List.xml', '<reflist name="test"/>');

    const result = runScript(originalDir, exportedDir);
    assert.equal(result.exitCode, 0);
    assert.ok(result.stdout.includes('OK'));
  });

  it('handles empty directories gracefully', () => {
    const result = runScript(originalDir, exportedDir);
    assert.equal(result.exitCode, 0);
    assert.ok(result.stdout.includes('Result: OK'));
  });
});

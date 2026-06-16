import { describe, it, beforeEach } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  validatePipelineInput,
  buildPipelineSteps,
  buildProcessPipelineSteps,
  parseArgs,
  logTestResults,
  logDryRunOutcome,
  getPipelineLabel,
  createDirectoryAndWriteFiles,
  handleMissingDecisionsError,
  loadPreviousContract,
  loadPreviousMcpContract,
} from '../src/pipeline.js';

// ---------------------------------------------------------------------------
// validatePipelineInput — extended coverage
// ---------------------------------------------------------------------------

describe('validatePipelineInput — menu mode', () => {
  it('accepts menuId alone', () => {
    const result = validatePipelineInput({ menuId: '999' });
    assert.equal(result.valid, true);
    assert.equal(result.mode, 'menu');
  });

  it('accepts menuName alone', () => {
    const result = validatePipelineInput({ menuName: 'Sales Order' });
    assert.equal(result.valid, true);
    assert.equal(result.mode, 'menu');
  });

  it('prefers menu mode when both menuId and windowId are present', () => {
    const result = validatePipelineInput({ menuId: '1', windowId: '2', windowName: 'x' });
    assert.equal(result.mode, 'menu');
  });
});

describe('validatePipelineInput — process mode', () => {
  it('accepts processId + processName', () => {
    const result = validatePipelineInput({ processId: 'P1', processName: 'Generate' });
    assert.equal(result.valid, true);
    assert.equal(result.mode, 'process');
  });

  it('rejects processId without processName', () => {
    const result = validatePipelineInput({ processId: 'P1' });
    assert.equal(result.valid, false);
    assert.ok(result.error.includes('processName'));
  });
});

describe('validatePipelineInput — report mode', () => {
  it('accepts reportId + reportName', () => {
    const result = validatePipelineInput({ reportId: 'R1', reportName: 'Balance' });
    assert.equal(result.valid, true);
    assert.equal(result.mode, 'report');
  });

  it('rejects reportId without reportName', () => {
    const result = validatePipelineInput({ reportId: 'R1' });
    assert.equal(result.valid, false);
    assert.ok(result.error.includes('reportName'));
  });
});

describe('validatePipelineInput — empty input', () => {
  it('rejects totally empty input', () => {
    const result = validatePipelineInput({});
    assert.equal(result.valid, false);
  });
});

// ---------------------------------------------------------------------------
// buildProcessPipelineSteps
// ---------------------------------------------------------------------------

describe('buildProcessPipelineSteps', () => {
  it('returns expected step count', () => {
    const steps = buildProcessPipelineSteps();
    assert.equal(steps.length, 5);
  });

  it('starts with extract-process', () => {
    const steps = buildProcessPipelineSteps();
    assert.equal(steps[0].name, 'extract-process');
  });

  it('ends with run-tests', () => {
    const steps = buildProcessPipelineSteps();
    assert.equal(steps[steps.length - 1].name, 'run-tests');
  });

  it('each step has name, description, and phase', () => {
    const steps = buildProcessPipelineSteps();
    for (const step of steps) {
      assert.ok(step.name, `step missing name`);
      assert.ok(step.description, `${step.name} missing description`);
      assert.ok(step.phase, `${step.name} missing phase`);
    }
  });

  it('all step names are unique', () => {
    const steps = buildProcessPipelineSteps();
    const names = steps.map(s => s.name);
    assert.equal(new Set(names).size, names.length);
  });

  it('all phases are unique', () => {
    const steps = buildProcessPipelineSteps();
    const phases = steps.map(s => s.phase);
    assert.equal(new Set(phases).size, phases.length);
  });

  it('phases start with P prefix', () => {
    const steps = buildProcessPipelineSteps();
    for (const step of steps) {
      assert.ok(step.phase.startsWith('P'), `${step.name} phase ${step.phase} should start with P`);
    }
  });
});

// ---------------------------------------------------------------------------
// getPipelineLabel
// ---------------------------------------------------------------------------

describe('getPipelineLabel', () => {
  it('returns "Report" when isReport is true', () => {
    assert.equal(getPipelineLabel(true), 'Report');
  });

  it('returns "Process" when isReport is false', () => {
    assert.equal(getPipelineLabel(false), 'Process');
  });

  it('returns "Process" when isReport is undefined', () => {
    assert.equal(getPipelineLabel(undefined), 'Process');
  });

  it('returns "Process" when isReport is null', () => {
    assert.equal(getPipelineLabel(null), 'Process');
  });
});

// ---------------------------------------------------------------------------
// createDirectoryAndWriteFiles
// ---------------------------------------------------------------------------

describe('createDirectoryAndWriteFiles', () => {
  it('calls mkdir with recursive true and writes all files', async () => {
    const mkdirCalls = [];
    const writeCalls = [];
    const mkdir = async (dir, opts) => { mkdirCalls.push({ dir, opts }); };
    const writeFile = async (path, content, enc) => { writeCalls.push({ path, content, enc }); };

    const files = { 'a.jsx': 'code-a', 'b.jsx': 'code-b' };
    await createDirectoryAndWriteFiles(mkdir, '/out/dir', files, writeFile);

    assert.equal(mkdirCalls.length, 1);
    assert.equal(mkdirCalls[0].dir, '/out/dir');
    assert.deepEqual(mkdirCalls[0].opts, { recursive: true });

    assert.equal(writeCalls.length, 2);
    assert.equal(writeCalls[0].path, '/out/dir/a.jsx');
    assert.equal(writeCalls[0].content, 'code-a');
    assert.equal(writeCalls[1].path, '/out/dir/b.jsx');
    assert.equal(writeCalls[1].content, 'code-b');
  });

  it('handles empty files object', async () => {
    const mkdirCalls = [];
    const writeCalls = [];
    const mkdir = async (dir, opts) => { mkdirCalls.push({ dir, opts }); };
    const writeFile = async (path, content, enc) => { writeCalls.push({ path, content, enc }); };

    await createDirectoryAndWriteFiles(mkdir, '/out', {}, writeFile);
    assert.equal(mkdirCalls.length, 1);
    assert.equal(writeCalls.length, 0);
  });
});

// ---------------------------------------------------------------------------
// handleMissingDecisionsError
// ---------------------------------------------------------------------------

describe('handleMissingDecisionsError', () => {
  it('throws non-ENOENT errors', () => {
    const err = new Error('permission denied');
    err.code = 'EACCES';
    assert.throws(() => handleMissingDecisionsError(err, '/path'), /permission denied/);
  });
});

// ---------------------------------------------------------------------------
// loadPreviousContract
// ---------------------------------------------------------------------------

describe('loadPreviousContract', () => {
  it('returns existing contract data when file exists', async () => {
    const contractData = { version: '1.2.0', frontendContract: {} };
    const readFile = async () => JSON.stringify(contractData);

    const result = await loadPreviousContract(readFile, 'sales-order', null, null, null);
    assert.equal(result.prevVersion, '1.2.0');
    assert.deepEqual(result.prevContract, contractData);
  });

  it('returns fallbacks when file does not exist', async () => {
    const readFile = async () => { const e = new Error('ENOENT'); e.code = 'ENOENT'; throw e; };

    const result = await loadPreviousContract(readFile, 'sales-order', 'fallback-v', { old: true }, 'raw');
    assert.equal(result.prevVersion, 'fallback-v');
    assert.deepEqual(result.prevContract, { old: true });
    assert.equal(result.prevContractRaw, 'raw');
  });

  it('drills down nested version objects', async () => {
    const contractData = { version: { version: { version: '2.0.0' } } };
    const readFile = async () => JSON.stringify(contractData);

    const result = await loadPreviousContract(readFile, 'test', null, null, null);
    assert.equal(result.prevVersion, '2.0.0');
  });

  it('handles version being null', async () => {
    const contractData = {};
    const readFile = async () => JSON.stringify(contractData);

    const result = await loadPreviousContract(readFile, 'test', 'old', null, null);
    assert.equal(result.prevVersion, null);
  });
});

// ---------------------------------------------------------------------------
// loadPreviousMcpContract
// ---------------------------------------------------------------------------

describe('loadPreviousMcpContract', () => {
  it('returns existing MCP contract when file exists', async () => {
    const mcpData = { tools: [] };
    const readFile = async () => JSON.stringify(mcpData);

    const result = await loadPreviousMcpContract(readFile, 'sales-order', null);
    assert.deepEqual(result, mcpData);
  });

  it('returns fallback when file does not exist', async () => {
    const readFile = async () => { const e = new Error('ENOENT'); e.code = 'ENOENT'; throw e; };

    const fallback = { old: true };
    const result = await loadPreviousMcpContract(readFile, 'sales-order', fallback);
    assert.deepEqual(result, fallback);
  });

  it('returns null fallback when nothing exists', async () => {
    const readFile = async () => { throw new Error('nope'); };

    const result = await loadPreviousMcpContract(readFile, 'test', null);
    assert.equal(result, null);
  });
});

// ---------------------------------------------------------------------------
// parseArgs — extra coverage
// ---------------------------------------------------------------------------

describe('parseArgs — combined flags', () => {
  const run = (...tokens) => parseArgs(['node', 'pipeline.js', ...tokens]);

  it('parses process flags together', () => {
    const result = run('--process-id', 'P1', '--process-name', 'Gen Invoices', '--dry-run');
    assert.equal(result.processId, 'P1');
    assert.equal(result.processName, 'Gen Invoices');
    assert.equal(result.dryRun, true);
  });

  it('parses report flags together', () => {
    const result = run('--report-id', 'R1', '--report-name', 'Aged Balance', '--skip-interactive');
    assert.equal(result.reportId, 'R1');
    assert.equal(result.reportName, 'Aged Balance');
    assert.equal(result.skipInteractive, true);
  });

  it('parses menu with skip-to', () => {
    const result = run('--menu-name', 'Purchase Order', '--skip-to', 'generate-frontend');
    assert.equal(result.menuName, 'Purchase Order');
    assert.equal(result.skipTo, 'generate-frontend');
  });

  it('ignores unknown flags gracefully', () => {
    const result = run('--unknown-flag', '143', 'sales-order');
    // --unknown-flag starts with -- so it's not treated as positional
    assert.equal(result.windowId, '143');
    assert.equal(result.windowName, 'sales-order');
  });
});

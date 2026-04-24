import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseQualityGateArgs, runQualityGateCli } from '../src/quality-gate.js';

const CONFIG = {
  checks: {
    parse: { enabled: true, severity: 'blocker' },
    imports: { enabled: true, severity: 'blocker' },
  },
  gate: {
    onBlockerFail: 'fail',
    regressionPolicy: 'no-worse-than-main',
    baselineRef: 'origin/main',
  },
  blastRadius: [
    { pattern: 'artifacts/*/decisions.json', scope: 'touched-window' },
    { pattern: 'cli/src/generate-frontend.js', scope: 'all-windows' },
  ],
  invariants: {},
};

describe('parseQualityGateArgs', () => {
  it('parses CLI flags into a normalized options object', () => {
    const options = parseQualityGateArgs([
      '--window', 'sales-order',
      '--baseline-ref', 'origin/develop',
      '--format', 'json',
      '--output', 'report.md',
      '--json', 'report.json',
      '--analysis-dir', 'analysis-bundle'
    ]);

    assert.equal(options.mode, 'window');
    assert.equal(options.windowName, 'sales-order');
    assert.equal(options.baselineRef, 'origin/develop');
    assert.equal(options.format, 'json');
    assert.equal(options.outputPath, 'report.md');
    assert.equal(options.jsonPath, 'report.json');
    assert.equal(options.analysisDir, 'analysis-bundle');
  });
});

describe('runQualityGateCli', () => {
  it('skips cleanly when no windows are affected and still writes requested artifacts', async () => {
    const rootDir = mkdtempSync(join(tmpdir(), 'quality-gate-cli-'));
    const markdownPath = join(rootDir, 'qg-report.md');
    const jsonPath = join(rootDir, 'qg-report.json');

    try {
      const result = await runQualityGateCli({
        args: ['--pr-affected', '--output', markdownPath, '--json', jsonPath],
        rootDir,
        deps: {
          loadConfig: async () => CONFIG,
          collectDecisionWindows: () => ['sales-order'],
          getChangedFiles: async () => ['README.md'],
          detectAffectedWindows: () => [],
          detectAffectedWindowsDetailed: () => [],
        },
      });

      assert.equal(result.exitCode, 0);
      assert.equal(result.summary, null);
      assert.match(result.stdout, /No windows affected; gate skipped/);
      assert.match(readFileSync(markdownPath, 'utf8'), /No windows affected; gate skipped/);
      const json = JSON.parse(readFileSync(jsonPath, 'utf8'));
      assert.equal(json.skipped, true);
      assert.deepEqual(json.windows, []);
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
    }
  });

  it('writes markdown and json outputs and returns a failing exit code when the gate fails', async () => {
    const rootDir = mkdtempSync(join(tmpdir(), 'quality-gate-cli-'));
    const markdownPath = join(rootDir, 'qg-report.md');
    const jsonPath = join(rootDir, 'qg-report.json');

    try {
      const result = await runQualityGateCli({
        args: ['--window', 'sales-order', '--output', markdownPath, '--json', jsonPath],
        rootDir,
        deps: {
          loadConfig: async () => CONFIG,
          runQualityGate: async () => ({
            summary: { gateVerdict: 'FAIL', affectedWindows: 1 },
            windows: [{
              window: 'sales-order',
              verdict: 'FAIL',
              score: { passed: 1, total: 2 },
              blockerFailures: ['imports'],
              checks: [
                { check: 'parse', severity: 'blocker', status: 'pass', detail: 'ok' },
                { check: 'imports', severity: 'blocker', status: 'fail', detail: 'Broken import' },
              ],
            }],
          }),
          resolveBaseline: async () => ({
            source: 'cache',
            baselineSha: 'abc1234',
            data: {
              windows: [{
                window: 'sales-order',
                score: { passed: 2, total: 2 },
                checks: [
                  { check: 'parse', severity: 'blocker', status: 'pass', detail: 'ok' },
                  { check: 'imports', severity: 'blocker', status: 'pass', detail: 'ok' },
                ],
              }],
            },
          }),
        },
      });

      assert.equal(result.exitCode, 1);
      assert.match(readFileSync(markdownPath, 'utf8'), /sales-order/);
      const json = JSON.parse(readFileSync(jsonPath, 'utf8'));
      assert.equal(json.summary.gateVerdict, 'FAIL');
      assert.equal(json.windows[0].delta, -1);
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
    }
  });

  it('writes an analyzable bundle for --all runs', async () => {
    const rootDir = mkdtempSync(join(tmpdir(), 'quality-gate-cli-'));
    const analysisDir = join(rootDir, 'analysis');

    try {
      const result = await runQualityGateCli({
        args: ['--all', '--analysis-dir', analysisDir],
        rootDir,
        deps: {
          loadConfig: async () => CONFIG,
          collectDecisionWindows: () => ['sales-order'],
          runQualityGate: async () => ({
            summary: { gateVerdict: 'FAIL', affectedWindows: 1 },
            windows: [{
              window: 'sales-order',
              verdict: 'FAIL',
              score: { passed: 1, total: 2 },
              blockerFailures: ['imports'],
              checks: [
                { check: 'parse', severity: 'blocker', status: 'pass', detail: 'ok' },
                { check: 'imports', severity: 'blocker', status: 'fail', detail: 'Broken import' }
              ]
            }]
          }),
          resolveBaseline: async () => ({
            source: 'cache',
            baselineSha: 'abc1234',
            data: { windows: [{ window: 'sales-order', score: { passed: 2, total: 2 } }] }
          })
        }
      });

      assert.equal(result.exitCode, 1);
      assert.match(readFileSync(join(analysisDir, 'report.json'), 'utf8'), /sales-order/);
      assert.match(readFileSync(join(analysisDir, 'summary.csv'), 'utf8'), /window,verdict,score_passed/);
      assert.match(readFileSync(join(analysisDir, 'checks.csv'), 'utf8'), /window,check,severity,status/);
      assert.match(readFileSync(join(analysisDir, 'checks.jsonl'), 'utf8'), /"check":"imports"/);
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
    }
  });

  it('defaults the analysis bundle path for --all', async () => {
    const rootDir = mkdtempSync(join(tmpdir(), 'quality-gate-cli-'));

    try {
      const result = await runQualityGateCli({
        args: ['--all'],
        rootDir,
        deps: {
          loadConfig: async () => CONFIG,
          collectDecisionWindows: () => ['sales-order'],
          runQualityGate: async () => ({
            summary: { gateVerdict: 'PASS', affectedWindows: 1 },
            windows: [{
              window: 'sales-order',
              verdict: 'PASS',
              score: { passed: 2, total: 2 },
              blockerFailures: [],
              checks: [
                { check: 'parse', severity: 'blocker', status: 'pass', detail: 'ok' }
              ]
            }]
          }),
          resolveBaseline: async () => ({
            source: 'cache',
            baselineSha: 'abc1234',
            data: { windows: [{ window: 'sales-order', score: { passed: 2, total: 2 } }] }
          })
        }
      });

      assert.equal(result.exitCode, 0);
      assert.equal(result.analysisDir, join(rootDir, '.quality-gate-cache', 'analysis', 'quality-gate-all'));
      assert.match(readFileSync(join(result.analysisDir, 'report.json'), 'utf8'), /sales-order/);
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
    }
  });
});

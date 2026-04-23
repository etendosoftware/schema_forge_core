import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { runQualityGate } from '../src/quality-gate/runner.js';
import { buildQualityGateReport } from '../src/quality-gate/report.js';

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
};

describe('runQualityGate', () => {
  it('marks a window FAIL when any blocker fails', async () => {
    const result = await runQualityGate({
      windowNames: ['alpha', 'beta'],
      rootDir: '/repo',
      config: CONFIG,
      checkers: {
        parse: async (windowName) => ({
          status: 'pass',
          detail: `${windowName} parsed`,
        }),
        imports: async (windowName) => windowName === 'beta'
          ? { status: 'fail', detail: 'Broken relative import' }
          : { status: 'pass', detail: 'Imports resolved' },
      },
    });

    assert.equal(result.summary.gateVerdict, 'FAIL');
    assert.equal(result.windows[0].verdict, 'PASS');
    assert.equal(result.windows[0].score.passed, 2);
    assert.equal(result.windows[0].score.total, 2);
    assert.equal(result.windows[1].verdict, 'FAIL');
    assert.deepEqual(result.windows[1].blockerFailures, ['imports']);
  });

  it('treats thrown checks as blocker failures without masking other results', async () => {
    const result = await runQualityGate({
      windowNames: ['alpha'],
      rootDir: '/repo',
      config: CONFIG,
      checkers: {
        parse: async () => {
          throw new Error('parser blew up');
        },
        imports: async () => ({ status: 'pass', detail: 'Imports resolved' }),
      },
    });

    assert.equal(result.summary.gateVerdict, 'FAIL');
    assert.equal(result.windows[0].checks[0].status, 'error');
    assert.match(result.windows[0].checks[0].detail, /parser blew up/);
    assert.equal(result.windows[0].checks[1].status, 'pass');
  });

  it('marks a window NO-OP when every enabled blocker skips', async () => {
    const result = await runQualityGate({
      windowNames: ['alpha'],
      rootDir: '/repo',
      config: CONFIG,
      checkers: {
        parse: async () => ({ status: 'skip', detail: 'No generated files' }),
        imports: async () => ({ status: 'skip', detail: 'No generated files' }),
      },
    });

    assert.equal(result.summary.gateVerdict, 'PASS');
    assert.equal(result.windows[0].verdict, 'NO-OP');
    assert.equal(result.summary.scoredWindows, 0);
  });
});

describe('buildQualityGateReport', () => {
  it('computes score deltas against baseline and renders markdown', () => {
    const report = buildQualityGateReport({
      baselineRef: 'origin/main',
      baselineSha: 'abc1234',
      headResult: {
        summary: { gateVerdict: 'FAIL' },
        windows: [
          {
            window: 'internal-consumption',
            verdict: 'FAIL',
            score: { passed: 1, total: 2 },
            blockerFailures: ['imports'],
            checks: [
              { check: 'parse', severity: 'blocker', status: 'pass', detail: 'ok' },
              { check: 'imports', severity: 'blocker', status: 'fail', detail: 'Broken relative import' },
            ],
          },
        ],
      },
      baselineResult: {
        windows: [
          {
            window: 'internal-consumption',
            score: { passed: 2, total: 2 },
          },
        ],
      },
    });

    assert.equal(report.summary.gateVerdict, 'FAIL');
    assert.equal(report.summary.windows[0].delta, -1);
    assert.match(report.markdown, /Schema Forge Quality Gate/);
    assert.match(report.markdown, /internal-consumption/);
    assert.match(report.markdown, /Broken relative import/);
    assert.match(report.markdown, /<!-- sfqg-report -->/);
  });

  it('fails the gate when a window regresses below baseline even without blocker failures', () => {
    const report = buildQualityGateReport({
      baselineRef: 'origin/main',
      baselineSha: 'abc1234',
      headResult: {
        summary: { gateVerdict: 'PASS' },
        windows: [
          {
            window: 'sales-order',
            verdict: 'PASS',
            score: { passed: 1, total: 2 },
            blockerFailures: [],
            checks: [
              { check: 'parse', severity: 'blocker', status: 'pass', detail: 'ok' },
              { check: 'imports', severity: 'blocker', status: 'skip', detail: 'not applicable' }
            ]
          }
        ]
      },
      baselineResult: {
        windows: [
          {
            window: 'sales-order',
            score: { passed: 2, total: 2 }
          }
        ]
      }
    });

    assert.equal(report.summary.gateVerdict, 'FAIL');
    assert.equal(report.summary.windows[0].delta, -1);
  });
});

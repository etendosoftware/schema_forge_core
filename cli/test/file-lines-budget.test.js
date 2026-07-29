import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { countLines, evaluate, loadConfig } from '../src/file-lines-budget.js';

const BIN = fileURLToPath(new URL('../src/file-lines-budget.js', import.meta.url));
const TRACKED = 'tools/app-shell/src/components/contract-ui/DetailView.jsx';

/**
 * Build a throwaway repo root that mimics the consuming (functional) repo: a
 * cli/file-lines-budget.json baseline plus the tracked file it points at. The CLI is
 * then run against it via SF_ROOT, which is exactly how CI and `make` drive it.
 */
function makeRepo({ lines, baseline }) {
  const root = mkdtempSync(join(tmpdir(), 'flb-'));
  mkdirSync(join(root, 'cli'), { recursive: true });
  mkdirSync(join(root, 'tools/app-shell/src/components/contract-ui'), { recursive: true });
  writeFileSync(join(root, TRACKED), `${Array.from({ length: lines }, (_, i) => `const l${i} = ${i};`).join('\n')}\n`);
  writeFileSync(
    join(root, 'cli', 'file-lines-budget.json'),
    `${JSON.stringify({ files: [{ label: 'DetailView.jsx', path: TRACKED, baseline }] }, null, 2)}\n`,
  );
  return root;
}

function runBin(root, args = []) {
  return spawnSync('node', [BIN, ...args], {
    encoding: 'utf8',
    env: { ...process.env, SF_ROOT: root },
  });
}

function readBaseline(root) {
  return JSON.parse(readFileSync(join(root, 'cli', 'file-lines-budget.json'), 'utf8')).files[0].baseline;
}

describe('countLines', () => {
  it('counts a newline-terminated file like wc -l', () => {
    assert.equal(countLines('a\nb\nc\n'), 3);
  });
  it('counts a final unterminated line', () => {
    assert.equal(countLines('a\nb\nc'), 3);
  });
  it('returns 0 for an empty file', () => {
    assert.equal(countLines(''), 0);
  });
  it('counts blank lines and comments (no skipping)', () => {
    assert.equal(countLines('a\n\n// c\n'), 3);
  });
  it('is monotonic: adding a line increases the count', () => {
    const before = countLines('a\nb\n');
    assert.equal(countLines('a\nb\nc\n'), before + 1);
  });
});

describe('evaluate (ratchet status)', () => {
  it('flags growth, parity and improvement', () => {
    const root = makeRepo({ lines: 10, baseline: 10 });
    try {
      const config = loadConfig(join(root, 'cli', 'file-lines-budget.json'));
      assert.equal(evaluate(config, { root })[0].status, 'ok');
      assert.equal(evaluate({ files: [{ path: TRACKED, baseline: 9 }] }, { root })[0].status, 'grew');
      const improved = evaluate({ files: [{ path: TRACKED, baseline: 25 }] }, { root })[0];
      assert.equal(improved.status, 'improved');
      assert.equal(improved.current, 10);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('reports a missing tracked file', () => {
    const res = evaluate({ files: [{ path: '/no/such/File.jsx', baseline: 1 }] });
    assert.equal(res[0].status, 'missing');
    assert.equal(res[0].current, null);
  });
});

describe('CLI (exit codes and --update)', () => {
  it('passes at baseline', () => {
    const root = makeRepo({ lines: 10, baseline: 10 });
    try {
      const res = runBin(root, ['--list']);
      assert.equal(res.status, 0);
      assert.match(res.stdout, /DetailView\.jsx: 10 lines \(baseline 10\)/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails when the file grew', () => {
    const root = makeRepo({ lines: 12, baseline: 10 });
    try {
      const res = runBin(root);
      assert.equal(res.status, 1);
      assert.match(res.stdout, /12 lines > baseline 10 \(\+2\)/);
      assert.match(res.stderr, /grew past their line budget/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('passes but nudges when the file shrank', () => {
    const root = makeRepo({ lines: 8, baseline: 10 });
    try {
      const res = runBin(root);
      assert.equal(res.status, 0);
      assert.match(res.stdout, /--update/);
      assert.equal(readBaseline(root), 10, 'baseline must not change without --update');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('--update lowers the baseline to the current count', () => {
    const root = makeRepo({ lines: 8, baseline: 10 });
    try {
      const res = runBin(root, ['--update']);
      assert.equal(res.status, 0);
      assert.equal(readBaseline(root), 8);
      // Re-running is now a no-op at parity.
      assert.equal(runBin(root).status, 0);
      assert.equal(readBaseline(root), 8);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('--update never raises the baseline for a file that grew', () => {
    const root = makeRepo({ lines: 12, baseline: 10 });
    try {
      const res = runBin(root, ['--update']);
      assert.equal(res.status, 1);
      assert.equal(readBaseline(root), 10);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('--json emits machine-readable results', () => {
    const root = makeRepo({ lines: 10, baseline: 10 });
    try {
      const res = runBin(root, ['--json']);
      assert.equal(res.status, 0);
      const parsed = JSON.parse(res.stdout);
      assert.equal(parsed[0].current, 10);
      assert.equal(parsed[0].status, 'ok');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('exits 2 when a tracked file is missing', () => {
    const root = makeRepo({ lines: 10, baseline: 10 });
    try {
      rmSync(join(root, TRACKED));
      const res = runBin(root);
      assert.equal(res.status, 2);
      assert.match(res.stderr, /not found/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

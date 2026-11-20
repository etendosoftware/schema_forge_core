// @covers scripts/check-cross-repo-duplicates.mjs
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, cpSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));

function makeRepo(files) {
  const dir = mkdtempSync(join(tmpdir(), 'dup-'));
  execFileSync('git', ['-C', dir, 'init', '-q']);
  for (const [f, c] of Object.entries(files)) {
    mkdirSync(join(dir, f, '..'), { recursive: true });
    writeFileSync(join(dir, f), c);
  }
  execFileSync('git', ['-C', dir, 'add', '-A']);
  return dir;
}

function run(coreFiles, otherFiles, registry) {
  const core = makeRepo({ ...coreFiles, 'scripts/cross-repo-duplicates.json': JSON.stringify(registry) });
  mkdirSync(join(core, 'scripts'), { recursive: true });
  cpSync(join(ROOT, 'scripts/check-cross-repo-duplicates.mjs'), join(core, 'scripts/check-cross-repo-duplicates.mjs'));
  const other = makeRepo(otherFiles);
  return spawnSync('node', [join(core, 'scripts/check-cross-repo-duplicates.mjs'), other], { encoding: 'utf8' });
}

describe('check-cross-repo-duplicates', () => {
  const empty = { divergent: {}, identical: {} };
  it('fails on an unregistered divergent path', () => {
    const r = run({ 'a.js': '1' }, { 'a.js': '2' }, empty);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /a\.js: differs/);
  });
  it('fails on a new identical copy', () => {
    const r = run({ 'a.js': '1' }, { 'a.js': '1' }, empty);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /new hand-made copy/);
  });
  it('passes when registered and flags stale entries', () => {
    assert.equal(run({ 'a.js': '1' }, { 'a.js': '2' }, { divergent: { 'a.js': 'x' }, identical: {} }).status, 0);
    const stale = run({ 'a.js': '1' }, { 'a.js': '1' }, { divergent: { 'a.js': 'x' }, identical: {} });
    assert.equal(stale.status, 1);
    assert.match(stale.stderr, /now identical/);
  });
});

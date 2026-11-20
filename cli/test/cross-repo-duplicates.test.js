// @covers scripts/check-cross-repo-duplicates.mjs
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
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
  const pinned = (c, o) => ({ reason: 'x', core: sha(c), schema_forge: sha(o) });
  const sha = (c) => createHash('sha256').update(c).digest('hex');
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
    assert.equal(run({ 'a.js': '1' }, { 'a.js': '2' }, { divergent: { 'a.js': pinned('1', '2') }, identical: {} }).status, 0);
    const stale = run({ 'a.js': '1' }, { 'a.js': '1' }, { divergent: { 'a.js': { reason: 'x' } }, identical: {} });
    assert.equal(stale.status, 1);
    assert.match(stale.stderr, /now identical/);
  });
  it('fails when either side of a registered divergent pair changes', () => {
    const reg = { divergent: { 'a.js': pinned('1', '2') }, identical: {} };
    const coreChanged = run({ 'a.js': '3' }, { 'a.js': '2' }, reg);
    assert.equal(coreChanged.status, 1);
    assert.match(coreChanged.stderr, /core side changed/);
    const otherChanged = run({ 'a.js': '1' }, { 'a.js': '4' }, reg);
    assert.equal(otherChanged.status, 1);
    assert.match(otherChanged.stderr, /schema_forge side changed/);
  });
  it('fails on a registered entry whose path is gone from one repo', () => {
    const r = run({ 'a.js': '1' }, { 'b.js': '1' }, { divergent: {}, identical: { 'a.js': 'x' } });
    assert.equal(r.status, 1);
    assert.match(r.stderr, /a\.js: registered as identical but no longer present/);
  });
  it('tolerates a registry without the divergent/identical keys', () => {
    assert.equal(run({ 'a.js': '1' }, { 'b.js': '1' }, {}).status, 0);
  });
  it('compares a moved module with its core home, import specifier aside', () => {
    const moved = { moved: { 'old.js': { core: 'new.js', reason: 'x' } } };
    const spec = "import { A } from '@etendosoftware/schema-forge-cli/src/report-i18n.js';\n";
    const ok = run({ 'new.js': "import { A } from './report-i18n.js';\nx" }, { 'old.js': `${spec}x` }, moved);
    assert.equal(ok.status, 0, ok.stderr);
    const bad = run({ 'new.js': "import { A } from './report-i18n.js';\nx" }, { 'old.js': `${spec}y` }, moved);
    assert.equal(bad.status, 1);
    assert.match(bad.stderr, /old\.js: differs from new\.js/);
  });
  it('exits 2 with usage when the other checkout is missing', () => {
    const r = spawnSync('node', [join(ROOT, 'scripts/check-cross-repo-duplicates.mjs')], { encoding: 'utf8' });
    assert.equal(r.status, 2);
    assert.match(r.stderr, /usage/);
  });
});

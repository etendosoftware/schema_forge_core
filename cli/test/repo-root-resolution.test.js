/**
 * Contract: an installed bin works on the repo it is run from (ETP-5511).
 *
 * Every CLI resolved its repo root as `SF_ROOT || <script dir>/../..`. From a
 * source checkout that is the checkout root, but once installed the script lives
 * in node_modules/@etendosoftware/schema-forge-cli/src, so `../..` is
 * node_modules/@etendosoftware. A plain `npx sf-validate-pipeline` from the
 * consumer repo root (documented in the functional repo's CLAUDE.md) then failed
 * with ENOENT on node_modules/@etendosoftware/artifacts.
 *
 * The root is now resolved in ONE place, `resolveRepoRoot()` in src/lib/repo-root.js:
 * SF_ROOT, else the checkout root when running from source, else the nearest
 * directory at or above cwd that holds artifacts/, else cwd. Never a path under
 * node_modules.
 */
import { describe, it, before, after } from 'node:test';
import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import {
  cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, statSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveRepoRoot } from '../src/lib/repo-root.js';

const CLI_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC_DIR = join(CLI_DIR, 'src');
const pkg = JSON.parse(readFileSync(join(CLI_DIR, 'package.json'), 'utf8'));

function listJs(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return listJs(full);
    return full.endsWith('.js') ? [full] : [];
  });
}

describe('resolveRepoRoot', () => {
  let tmp;
  before(() => { tmp = mkdtempSync(join(tmpdir(), 'sf-root-')); });
  after(() => rmSync(tmp, { recursive: true, force: true }));

  const installed = () => join(tmp, 'consumer', 'node_modules', '@etendosoftware', 'schema-forge-cli');

  it('prefers SF_ROOT', () => {
    assert.equal(
      resolveRepoRoot({ env: { SF_ROOT: 'rel/dir' }, cwd: tmp, packageRoot: installed() }),
      resolve('rel/dir'),
    );
  });

  it('uses the checkout root when running from source', () => {
    const checkout = join(tmp, 'checkout');
    assert.equal(resolveRepoRoot({ env: {}, cwd: tmp, packageRoot: join(checkout, 'cli') }), checkout);
  });

  it('when installed, walks up from cwd to the directory that holds artifacts/', () => {
    const consumer = join(tmp, 'consumer');
    const deep = join(consumer, 'tools', 'app-shell');
    mkdirSync(join(consumer, 'artifacts'), { recursive: true });
    mkdirSync(deep, { recursive: true });
    assert.equal(resolveRepoRoot({ env: {}, cwd: deep, packageRoot: installed() }), consumer);
  });

  it('when installed and no artifacts/ is found, falls back to cwd — never node_modules', () => {
    const bare = join(tmp, 'bare');
    mkdirSync(bare);
    assert.equal(resolveRepoRoot({ env: {}, cwd: bare, packageRoot: installed() }), bare);
  });
});

describe('installed sf-validate-pipeline without SF_ROOT', () => {
  let tmp;
  let consumer;
  let installedCli;

  before(() => {
    tmp = mkdtempSync(join(tmpdir(), 'sf-installed-'));
    consumer = join(tmp, 'consumer');
    installedCli = join(consumer, 'node_modules', '@etendosoftware', 'schema-forge-cli');
    mkdirSync(join(consumer, 'artifacts'), { recursive: true });
    // A real copy, not a symlink: Node resolves a symlinked main module to its
    // realpath, which would put the script back in this checkout and hide the bug.
    cpSync(SRC_DIR, join(installedCli, 'src'), { recursive: true });
    cpSync(join(CLI_DIR, 'package.json'), join(installedCli, 'package.json'));
    // Runtime deps resolve through symlinks to this repo's node_modules.
    for (const dep of Object.keys(pkg.dependencies)) {
      const source = resolve(CLI_DIR, '..', 'node_modules', dep);
      if (!existsSync(source)) continue;
      const target = join(consumer, 'node_modules', dep);
      mkdirSync(dirname(target), { recursive: true });
      if (!existsSync(target)) symlinkSync(source, target);
    }
  });

  after(() => rmSync(tmp, { recursive: true, force: true }));

  it('validates the artifacts/ of the repo it is run from', () => {
    const env = { ...process.env };
    delete env.SF_ROOT;
    const res = spawnSync(process.execPath, [join(installedCli, 'src', 'validate-pipeline.js')], {
      cwd: consumer,
      env,
      encoding: 'utf8',
      timeout: 60_000,
    });
    const output = `${res.stdout}${res.stderr}`;
    assert.doesNotMatch(output, /ENOENT/, output);
    assert.doesNotMatch(output, /node_modules[\\/]@etendosoftware[\\/]artifacts/, output);
    assert.equal(res.status, 0, output);
  });
});

describe('repo root is resolved in one place', () => {
  it('no src module reads SF_ROOT except lib/repo-root.js', () => {
    const offenders = listJs(SRC_DIR)
      .filter((file) => !file.endsWith(join('src', 'lib', 'repo-root.js')))
      .filter((file) => /process\.env\.SF_ROOT/.test(readFileSync(file, 'utf8')))
      .map((file) => relative(CLI_DIR, file));
    assert.deepEqual(offenders, [], `resolve the repo root with resolveRepoRoot() from src/lib/repo-root.js:\n  ${offenders.join('\n  ')}`);
  });
});

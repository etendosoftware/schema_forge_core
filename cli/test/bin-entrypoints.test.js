/**
 * Contract for every `bin` entry of @etendosoftware/schema-forge-cli (ETP-5511).
 *
 * The functional repo runs these through `npx <bin>`, i.e. through a
 * node_modules/.bin/<bin> SYMLINK to the script. Two failure modes shipped and
 * both are silent from the caller's side:
 *
 *   1. No `#!/usr/bin/env node` shebang: the symlink is executed by /bin/sh and
 *      every `import ...` line runs ImageMagick's `import` command instead.
 *   2. A main-module guard that does not match when argv[1] is the symlink
 *      (argv[1] keeps the symlink path, import.meta.url is the realpath): the
 *      script imports cleanly, skips its CLI block and exits 0 doing nothing.
 *
 * So for every bin: (a) the target starts with the node shebang, and (b) run
 * through a symlink named after the bin it actually does something — prints
 * usage, an error, or a result. Silent exit 0 is the bug.
 *
 * Hermetic: cwd and SF_ROOT point at an empty temp dir, PATH holds only the node
 * binary (docker, git and ImageMagick are unreachable) and PG* points at a
 * closed port, so no bin can reach a DB, a container or the real repo.
 */
import { describe, it, before, after } from 'node:test';
import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, symlinkSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const CLI_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { bin } = JSON.parse(readFileSync(join(CLI_DIR, 'package.json'), 'utf8'));
const SHEBANG = '#!/usr/bin/env node';

// The lightest no-side-effect invocation per bin. Default is `--help`; a bin is
// listed here only when `--help` would make it do real work.
const ARGS = {
  // --help is not parsed; without --dry-run it would regenerate every window
  // under SF_ROOT (empty here, but --dry-run keeps it harmless by construction).
  'sf-regen-all': ['--dry-run'],
};

describe('cli package.json bin entries', () => {
  let tmp;
  let binDir;
  let workDir;

  before(() => {
    tmp = mkdtempSync(join(tmpdir(), 'sf-bin-'));
    binDir = join(tmp, 'bin');
    workDir = join(tmp, 'work');
    mkdirSync(binDir);
    mkdirSync(workDir);
  });

  after(() => rmSync(tmp, { recursive: true, force: true }));

  it('declares at least one bin', () => {
    assert.ok(Object.keys(bin).length > 0);
  });

  for (const [name, target] of Object.entries(bin)) {
    const scriptPath = join(CLI_DIR, target);
    const hasShebang = () => readFileSync(scriptPath, 'utf8').startsWith(`${SHEBANG}\n`);

    it(`${name}: ${target} starts with "${SHEBANG}"`, () => {
      assert.ok(hasShebang(), `${target} has no node shebang — /bin/sh would execute it`);
    });

    it(`${name}: runs when invoked through a .bin symlink`, () => {
      const link = join(binDir, name);
      symlinkSync(scriptPath, link);
      // Exec the symlink itself, exactly as npx does. When the shebang is
      // missing, fall back to `node <link>` so this test still isolates the
      // main-module guard instead of repeating the shebang failure.
      const [cmd, argv] = hasShebang()
        ? [link, []]
        : [process.execPath, [link]];
      const res = spawnSync(cmd, [...argv, ...(ARGS[name] ?? ['--help'])], {
        cwd: workDir,
        encoding: 'utf8',
        timeout: 30_000,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: {
          HOME: tmp,
          PATH: dirname(process.execPath),
          SF_ROOT: workDir,
          PGHOST: '127.0.0.1',
          PGPORT: '1',
          NO_COLOR: '1',
        },
      });
      assert.equal(res.error, undefined, `${name} failed to spawn: ${res.error?.message}`);
      assert.equal(res.signal, null, `${name} was killed (${res.signal}) — it hung instead of exiting`);
      const output = `${res.stdout}${res.stderr}`.trim();
      assert.ok(
        output.length > 0,
        `${name} exited ${res.status} with no output — its main-module guard did not match through the symlink`,
      );
    });
  }
});

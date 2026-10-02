/**
 * Contract: a bin that takes a positional argument answers `--help` / `-h` with
 * its usage and exit 0, instead of treating the flag as that argument (ETP-5511).
 *
 * `sf-generate-frontend --help` read a contract file called "--help" (ENOENT,
 * exit 1); `sf-gen-log --help` went further and wrote a generation log for a
 * window called "--help" into artifacts/. So besides the exit code and the usage
 * text, the run must leave the working tree untouched.
 */
import { describe, it, before, after } from 'node:test';
import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const CLI_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { bin } = JSON.parse(readFileSync(join(CLI_DIR, 'package.json'), 'utf8'));

// Bins whose first positional argument is a path or a window name.
const POSITIONAL_BINS = [
  'sf-generate-frontend',
  'sf-test-report',
  'sf-gen-log',
  'sf-check-version',
  'sf-generate-public-api-schema',
  'sf-menu-cache',
];

describe('--help on bins with a positional argument', () => {
  let tmp;
  let binDir;

  before(() => {
    tmp = mkdtempSync(join(tmpdir(), 'sf-help-'));
    binDir = join(tmp, 'bin');
    mkdirSync(binDir);
    for (const name of POSITIONAL_BINS) symlinkSync(join(CLI_DIR, bin[name]), join(binDir, name));
  });

  after(() => rmSync(tmp, { recursive: true, force: true }));

  for (const name of POSITIONAL_BINS) {
    for (const flag of ['--help', '-h']) {
      it(`${name} ${flag} prints usage, exits 0 and writes nothing`, () => {
        const work = mkdtempSync(join(tmp, 'work-'));
        const res = spawnSync(join(binDir, name), [flag], {
          cwd: work,
          encoding: 'utf8',
          timeout: 30_000,
          env: { HOME: tmp, PATH: dirname(process.execPath), SF_ROOT: work, PGHOST: '127.0.0.1', PGPORT: '1' },
        });
        const output = `${res.stdout}${res.stderr}`;
        assert.equal(res.status, 0, output);
        assert.match(res.stdout, /usage/i, output);
        assert.deepEqual(readdirSync(work), [], `${name} ${flag} wrote into the working tree`);
      });
    }
  }
});

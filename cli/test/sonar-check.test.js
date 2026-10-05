// @covers cli/sonar-check.sh
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, chmodSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SCRIPT = fileURLToPath(new URL('../sonar-check.sh', import.meta.url));

// Runs the script against a stub `sonar-scanner` that only echoes its args, so
// the base-dir detection is exercised without a SonarQube server. The timeout
// turns a hang (the bug this file guards) into a failure instead of a stuck run.
function runScript(files, { cwd, binDir }) {
  return spawnSync('bash', [SCRIPT, '--no-wait', ...files], {
    cwd,
    encoding: 'utf8',
    timeout: 10_000,
    env: {
      ...process.env,
      PATH: `${binDir}:${process.env.PATH}`,
      SONAR_TOKEN: 'test-token',
      SONAR_HOST_URL: 'http://sonar.invalid',
    },
  });
}

describe('sonar-check.sh base-dir detection', () => {
  let root;

  before(() => {
    root = realpathSync(mkdtempSync(join(tmpdir(), 'sonar-check-')));
    mkdirSync(join(root, 'bin'));
    writeFileSync(join(root, 'bin', 'sonar-scanner'), '#!/usr/bin/env bash\necho "SCANNER $*"\n');
    chmodSync(join(root, 'bin', 'sonar-scanner'), 0o755);
    spawnSync('git', ['init', '-q', join(root, 'repo')]);
    for (const dir of ['src/a/deep', 'src/b', 'srcx']) mkdirSync(join(root, 'repo', dir), { recursive: true });
    for (const file of ['src/a/deep/One.java', 'src/b/Two.java', 'srcx/Three.java']) {
      writeFileSync(join(root, 'repo', file), 'class X {}\n');
    }
  });

  after(() => rmSync(root, { recursive: true, force: true }));

  it('terminates and uses the common ancestor when files live in different directories', () => {
    const repo = join(root, 'repo');
    const result = runScript(['src/a/deep/One.java', 'src/b/Two.java'], { cwd: repo, binDir: join(root, 'bin') });
    assert.equal(result.error, undefined, `script did not terminate: ${result.error}`);
    assert.equal(result.status, 0, `${result.stderr}\n${result.stdout}`);
    assert.match(result.stdout, new RegExp(`Base dir: ${join(repo, 'src')}\\n`));
    assert.match(result.stdout, /sonar\.inclusions=a\/deep\/One\.java,b\/Two\.java/);
  });

  it('respects path boundaries — a sibling sharing a name prefix is not an ancestor', () => {
    const repo = join(root, 'repo');
    const result = runScript(['src/b/Two.java', 'srcx/Three.java'], { cwd: repo, binDir: join(root, 'bin') });
    assert.equal(result.error, undefined, `script did not terminate: ${result.error}`);
    assert.equal(result.status, 0, `${result.stderr}\n${result.stdout}`);
    assert.match(result.stdout, new RegExp(`Base dir: ${repo}\\n`));
    assert.match(result.stdout, /sonar\.inclusions=src\/b\/Two\.java,srcx\/Three\.java/);
  });
});

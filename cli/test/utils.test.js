import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, symlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { computeChecksum, generateVersion, toCamelCase, isMainModule } from '../src/utils.js';

const THIS_FILE = fileURLToPath(import.meta.url);

describe('utils', () => {
  it('computeChecksum produces consistent hex hash', () => {
    const hash1 = computeChecksum('hello world');
    const hash2 = computeChecksum('hello world');
    assert.equal(hash1, hash2);
    assert.match(hash1, /^[0-9a-f]{8,}$/);
  });

  it('computeChecksum changes when input changes', () => {
    assert.notEqual(computeChecksum('hello'), computeChecksum('world'));
  });

  it('generateVersion returns semver format', () => {
    assert.match(generateVersion(), /^\d+\.\d+\.\d+$/);
  });

  it('toCamelCase converts column names', () => {
    assert.equal(toCamelCase('DocumentNo'), 'documentNo');
    assert.equal(toCamelCase('AD_Client_ID'), 'adClientId');
    assert.equal(toCamelCase('C_Order_ID'), 'cOrderId');
    assert.equal(toCamelCase('IsActive'), 'isActive');
  });

  describe('isMainModule', () => {
    it('returns false when process.argv[1] is not set', () => {
      const originalArgv1 = process.argv[1];
      process.argv[1] = undefined;
      try {
        assert.equal(isMainModule(import.meta.url), false);
      } finally {
        process.argv[1] = originalArgv1;
      }
    });

    it('returns true when argv[1] is the exact same file (no symlink involved)', () => {
      const originalArgv1 = process.argv[1];
      process.argv[1] = THIS_FILE;
      try {
        assert.equal(isMainModule(import.meta.url), true);
      } finally {
        process.argv[1] = originalArgv1;
      }
    });

    it('returns false for an unrelated file', () => {
      const originalArgv1 = process.argv[1];
      process.argv[1] = '/definitely/not/this/file.js';
      try {
        assert.equal(isMainModule(import.meta.url), false);
      } finally {
        process.argv[1] = originalArgv1;
      }
    });

    it('returns true when argv[1] is a symlink to the real module file — the npm-bin regression case', () => {
      // Reproduces exactly how `npm install`/npx invoke a CLI bin: node_modules/.bin/<name>
      // is a symlink to the real src/*.js file. import.meta.url resolves through the
      // symlink to the real file; process.argv[1] previously kept the symlink path,
      // so a plain string comparison silently failed and the CLI entrypoint never ran.
      const dir = mkdtempSync(join(tmpdir(), 'sf-isMainModule-'));
      const symlinkPath = join(dir, 'sf-fake-bin');
      symlinkSync(THIS_FILE, symlinkPath);
      const originalArgv1 = process.argv[1];
      process.argv[1] = symlinkPath;
      try {
        assert.equal(isMainModule(import.meta.url), true);
      } finally {
        process.argv[1] = originalArgv1;
        rmSync(dir, { recursive: true, force: true });
      }
    });
  });
});

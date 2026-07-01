import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { APP_SHELL_PEERS, STACK_PACKAGES, doctorStack, verifyStack } from '../src/index.js';

describe('schema forge stack', () => {
  it('declares stack package dependencies', () => {
    assert.deepEqual(STACK_PACKAGES, [
      '@etendosoftware/schema-forge-core',
      '@etendosoftware/app-shell-core',
      '@etendosoftware/schema-forge-agent-context',
    ]);
  });

  it('tracks app shell peer dependencies for doctor checks', () => {
    assert.ok(APP_SHELL_PEERS.includes('react'));
    assert.ok(APP_SHELL_PEERS.includes('react-dom'));
    assert.ok(APP_SHELL_PEERS.includes('@radix-ui/react-dialog'));
  });

  it('resolves stack packages in the workspace', async () => {
    const report = await doctorStack({ includePeers: false });

    assert.equal(report.ok, true);
    assert.equal(report.packages.length, 3);
  });

  it('verifies package imports when peers are installed', async () => {
    const report = await verifyStack();

    assert.equal(report.ok, true);
  });
});

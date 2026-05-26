import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';

import { installAgentContext, listAgentContextFiles } from '../src/index.js';

describe('schema forge agent context', () => {
  it('lists packaged context files', async () => {
    const files = await listAgentContextFiles();

    assert.ok(files.includes('AGENTS.md'));
    assert.ok(files.includes('CLAUDE.md'));
    assert.ok(files.includes('.github/copilot-instructions.md'));
    assert.ok(files.includes('docs/agent-context-index.md'));
  });

  it('installs context without overwriting existing files by default', async () => {
    const targetDir = await mkdtemp(path.join(os.tmpdir(), 'sf-agent-context-'));
    await writeFile(path.join(targetDir, 'AGENTS.md'), 'local context');

    const results = await installAgentContext({ targetDir });
    const agentsResult = results.find((result) => result.file === 'AGENTS.md');
    const claudeResult = results.find((result) => result.file === 'CLAUDE.md');

    assert.equal(agentsResult.status, 'skipped');
    assert.equal(claudeResult.status, 'installed');
    assert.equal(await readFile(path.join(targetDir, 'AGENTS.md'), 'utf8'), 'local context');
  });

  it('supports dry-run installs', async () => {
    const targetDir = await mkdtemp(path.join(os.tmpdir(), 'sf-agent-context-'));
    const results = await installAgentContext({ targetDir, dryRun: true });

    assert.ok(results.every((result) => result.status === 'planned'));
  });
});

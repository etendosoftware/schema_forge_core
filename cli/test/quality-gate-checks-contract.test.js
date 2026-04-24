import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runContractCheck } from '../src/quality-gate/checks/contract.js';

function makeRoot() {
  const rootDir = mkdtempSync(join(tmpdir(), 'quality-gate-contract-'));
  const windowDir = join(rootDir, 'artifacts', 'sales-order');
  mkdirSync(join(rootDir, 'schemas'), { recursive: true });
  mkdirSync(windowDir, { recursive: true });
  return { rootDir, windowDir };
}

describe('runContractCheck', () => {
  it('passes when contract.json matches the schema', async () => {
    const { rootDir, windowDir } = makeRoot();

    try {
      writeFileSync(
        join(rootDir, 'schemas', 'contract.schema.json'),
        JSON.stringify({
          type: 'object',
          required: ['frontendContract'],
          properties: {
            frontendContract: { type: 'object' },
          },
          additionalProperties: true,
        }, null, 2),
      );
      writeFileSync(join(windowDir, 'contract.json'), JSON.stringify({ frontendContract: {} }, null, 2));

      const result = await runContractCheck('sales-order', { rootDir, windowDir });
      assert.deepEqual(result, { status: 'pass', detail: 'contract.json matches schemas/contract.schema.json.' });
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
    }
  });

  it('fails with Ajv errors when contract.json is invalid', async () => {
    const { rootDir, windowDir } = makeRoot();

    try {
      writeFileSync(
        join(rootDir, 'schemas', 'contract.schema.json'),
        JSON.stringify({
          type: 'object',
          required: ['frontendContract'],
          properties: {
            frontendContract: { type: 'object' },
          },
          additionalProperties: false,
        }, null, 2),
      );
      writeFileSync(join(windowDir, 'contract.json'), JSON.stringify({ wrong: true }, null, 2));

      const result = await runContractCheck('sales-order', { rootDir, windowDir });
      assert.equal(result.status, 'fail');
      assert.match(result.detail, /frontendContract/);
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
    }
  });
});

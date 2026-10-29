import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mcpUrlFor } from '../mcpClients.js';

// ETP-5852: production announces https://app.etendo.ai/mcp, so a user on the legacy
// app.etendo.software host must be given that URL; every other origin is kept.
describe('mcpUrlFor', () => {
  const cases = [
    ['legacy production domain', 'https://app.etendo.software', 'https://app.etendo.ai/mcp'],
    ['another .etendo.software host is kept', 'https://staging.app.etendo.software', 'https://staging.app.etendo.software/mcp'],
    ['official domain', 'https://app.etendo.ai', 'https://app.etendo.ai/mcp'],
    ['local origin with port', 'http://localhost:3105', 'http://localhost:3105/mcp'],
    ['lookalike host is not rewritten', 'https://notetendo.software', 'https://notetendo.software/mcp'],
  ];
  for (const [label, origin, expected] of cases) {
    it(label, () => {
      assert.equal(mcpUrlFor(origin), expected);
    });
  }
});

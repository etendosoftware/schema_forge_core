import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { analyzeSpec, main } from '../../scripts/selector-inventory.js';

describe('selector-inventory', () => {
  it('returns no rows for an unknown spec', () => {
    assert.deepEqual(analyzeSpec('missing-spec'), []);
  });

  it('prints the CSV header even when no selector rows are found', () => {
    const lines = [];
    main(['missing-spec'], line => lines.push(line));

    assert.equal(lines.length, 1);
    assert.match(lines[0], /^spec,entity,field,column,inputMode,category/);
  });
});

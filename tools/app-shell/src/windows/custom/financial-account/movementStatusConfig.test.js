import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// movementStatusConfig.js is a pure data map — tests verify shape integrity.
const { MOVEMENT_STATUS_CONFIG, ALL_STATUSES } = await import('./movementStatusConfig.js');

describe('movementStatusConfig', () => {
  it('exports ALL_STATUSES as an array of 8 known search keys', () => {
    const expected = ['RPAP', 'RPAE', 'RPVOID', 'RPR', 'PPM', 'PWNC', 'RDNC', 'RPPC'];
    assert.deepEqual(ALL_STATUSES, expected);
  });

  it('every status has a family and a labelKey', () => {
    for (const key of ALL_STATUSES) {
      const cfg = MOVEMENT_STATUS_CONFIG[key];
      assert.ok(cfg, `${key} missing from MOVEMENT_STATUS_CONFIG`);
      assert.ok(typeof cfg.family === 'string', `${key}.family must be a string`);
      assert.ok(typeof cfg.labelKey === 'string', `${key}.labelKey must be a string`);
    }
  });

  it('ALL_STATUSES length matches MOVEMENT_STATUS_CONFIG keys', () => {
    assert.equal(ALL_STATUSES.length, Object.keys(MOVEMENT_STATUS_CONFIG).length);
  });
});

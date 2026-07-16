import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validateRow, validateRows } from '../validateRows.js';

describe('validateRow', () => {
  it('passes a row with all required fields present', () => {
    const result = validateRow({ name: 'Lucia' }, { requiredTargets: ['name'] });
    assert.equal(result.valid, true);
    assert.deepEqual(result.errors, []);
  });

  it('fails a row missing a required field', () => {
    const result = validateRow({ name: '' }, { requiredTargets: ['name'] });
    assert.equal(result.valid, false);
    assert.deepEqual(result.errors, [{ target: 'name', message: 'Required field is missing.' }]);
  });

  it('treats whitespace-only values as missing', () => {
    const result = validateRow({ name: '   ' }, { requiredTargets: ['name'] });
    assert.equal(result.valid, false);
  });

  it('validates email format on emailTargets', () => {
    const bad = validateRow({ email: 'not-an-email' }, { requiredTargets: [], emailTargets: ['email'] });
    assert.equal(bad.valid, false);
    assert.equal(bad.errors[0].target, 'email');

    const good = validateRow({ email: 'lucia@x.com' }, { requiredTargets: [], emailTargets: ['email'] });
    assert.equal(good.valid, true);
  });

  it('does not flag a blank, non-required email field as a format error', () => {
    const result = validateRow({ email: '' }, { requiredTargets: [], emailTargets: ['email'] });
    assert.equal(result.valid, true);
  });

  it('fails a row whose FK value is not yet resolved', () => {
    const fkResolutions = new Map([['uom', new Map([['Kg', { status: 'auto-resolved', id: 'U-1', name: 'Kilogramo' }]])]]);
    const result = validateRow(
      { uom: 'Widget' },
      { requiredTargets: [], fkTargets: ['uom'], fkResolutions },
    );
    assert.equal(result.valid, false);
    assert.equal(result.errors[0].target, 'uom');
  });

  it('fails a row whose FK value is still needs-review', () => {
    const fkResolutions = new Map([['uom', new Map([['Kg', { status: 'needs-review', candidates: [] }]])]]);
    const result = validateRow({ uom: 'Kg' }, { requiredTargets: [], fkTargets: ['uom'], fkResolutions });
    assert.equal(result.valid, false);
  });

  it('passes a row whose FK value is auto-resolved', () => {
    const fkResolutions = new Map([['uom', new Map([['Kg', { status: 'auto-resolved', id: 'U-1', name: 'Kilogramo' }]])]]);
    const result = validateRow({ uom: 'Kg' }, { requiredTargets: [], fkTargets: ['uom'], fkResolutions });
    assert.equal(result.valid, true);
  });

  it('skips FK validation for a blank, non-required FK field', () => {
    const result = validateRow({ uom: '' }, { requiredTargets: [], fkTargets: ['uom'], fkResolutions: new Map() });
    assert.equal(result.valid, true);
  });

  it('collects multiple errors across targets', () => {
    const result = validateRow(
      { name: '', email: 'bad' },
      { requiredTargets: ['name'], emailTargets: ['email'] },
    );
    assert.equal(result.errors.length, 2);
  });
});

describe('validateRows', () => {
  it('maps validateRow over every row', () => {
    const rows = [{ name: 'Lucia' }, { name: '' }];
    const results = validateRows(rows, { requiredTargets: ['name'] });
    assert.equal(results.length, 2);
    assert.equal(results[0].valid, true);
    assert.equal(results[1].valid, false);
    assert.equal(results[1].row, rows[1]);
  });
});

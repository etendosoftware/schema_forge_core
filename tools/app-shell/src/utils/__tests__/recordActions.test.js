import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isDeleteVisibleForRecord, DELETABLE_DOC_STATUSES } from '../recordActions.js';

describe('isDeleteVisibleForRecord', () => {
  it('returns true when hideDeleteWhenComplete is false (feature opt-out)', () => {
    assert.equal(
      isDeleteVisibleForRecord({
        record: { documentStatus: 'CO' },
        statusField: 'documentStatus',
        hideDeleteWhenComplete: false,
      }),
      true,
    );
  });

  it('returns true when no statusField is configured (no gate to apply)', () => {
    assert.equal(
      isDeleteVisibleForRecord({
        record: { documentStatus: 'CO' },
        statusField: null,
        hideDeleteWhenComplete: true,
      }),
      true,
    );
  });

  it('returns true for draft records', () => {
    assert.equal(
      isDeleteVisibleForRecord({
        record: { documentStatus: 'DR' },
        statusField: 'documentStatus',
        hideDeleteWhenComplete: true,
      }),
      true,
    );
  });

  it('returns true for RPAP (pending approval) records', () => {
    assert.equal(
      isDeleteVisibleForRecord({
        record: { documentStatus: 'RPAP' },
        statusField: 'documentStatus',
        hideDeleteWhenComplete: true,
      }),
      true,
    );
  });

  it('returns false for completed records', () => {
    assert.equal(
      isDeleteVisibleForRecord({
        record: { documentStatus: 'CO' },
        statusField: 'documentStatus',
        hideDeleteWhenComplete: true,
      }),
      false,
    );
  });

  it('returns false for voided records', () => {
    assert.equal(
      isDeleteVisibleForRecord({
        record: { documentStatus: 'VO' },
        statusField: 'documentStatus',
        hideDeleteWhenComplete: true,
      }),
      false,
    );
  });

  it('returns true for records with empty/null status (treated as new)', () => {
    assert.equal(
      isDeleteVisibleForRecord({
        record: { documentStatus: null },
        statusField: 'documentStatus',
        hideDeleteWhenComplete: true,
      }),
      true,
    );
    assert.equal(
      isDeleteVisibleForRecord({
        record: { documentStatus: '' },
        statusField: 'documentStatus',
        hideDeleteWhenComplete: true,
      }),
      true,
    );
    assert.equal(
      isDeleteVisibleForRecord({
        record: {},
        statusField: 'documentStatus',
        hideDeleteWhenComplete: true,
      }),
      true,
    );
  });

  it('handles missing record gracefully', () => {
    assert.equal(
      isDeleteVisibleForRecord({
        record: null,
        statusField: 'documentStatus',
        hideDeleteWhenComplete: true,
      }),
      true,
    );
  });

  it('exposes the deletable status whitelist', () => {
    assert.deepEqual(DELETABLE_DOC_STATUSES, ['DR', 'RPAP']);
  });
});

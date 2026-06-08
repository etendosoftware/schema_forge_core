// Unit tests for evalTabReadOnly helper in DetailView.jsx.
//
// The helper guards secondary-tab mutation actions (add / edit / delete) on
// a per-record basis: when the tab declares a `readOnlyLogic(record)` and it
// returns truthy, the DetailView suppresses these mutations while still
// rendering existing rows.
//
// These tests cover the contract directly, without spinning up React.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { evalTabReadOnly } from '../../tools/app-shell/src/components/contract-ui/evalTabReadOnly.js';

describe('evalTabReadOnly', () => {
  it('returns false when tab is null or undefined', () => {
    assert.equal(evalTabReadOnly(null, { foo: 'bar' }), false);
    assert.equal(evalTabReadOnly(undefined, {}), false);
  });

  it('returns false when readOnlyLogic is not declared', () => {
    assert.equal(evalTabReadOnly({ key: 'tax' }, { documentStatus: 'CO' }), false);
  });

  it('returns true when readOnlyLogic returns truthy', () => {
    const tab = {
      key: 'exchangeRates',
      readOnlyLogic: (record) => record.documentStatus !== 'DR',
    };
    assert.equal(evalTabReadOnly(tab, { documentStatus: 'CO' }), true);
  });

  it('returns false when readOnlyLogic returns falsy', () => {
    const tab = {
      key: 'exchangeRates',
      readOnlyLogic: (record) => record.documentStatus !== 'DR',
    };
    assert.equal(evalTabReadOnly(tab, { documentStatus: 'DR' }), false);
  });

  it('coerces non-boolean truthy results to true', () => {
    const tab = { readOnlyLogic: () => 'yes' };
    assert.equal(evalTabReadOnly(tab, {}), true);
  });

  it('passes an empty object to readOnlyLogic when record is null', () => {
    let received = null;
    const tab = {
      readOnlyLogic: (record) => {
        received = record;
        return false;
      },
    };
    evalTabReadOnly(tab, null);
    assert.deepEqual(received, {});
  });

  it('passes an empty object to readOnlyLogic when record is undefined', () => {
    let received = null;
    const tab = {
      readOnlyLogic: (record) => {
        received = record;
        return false;
      },
    };
    evalTabReadOnly(tab);
    assert.deepEqual(received, {});
  });

  it('returns false (does not throw) when readOnlyLogic throws', () => {
    const tab = {
      readOnlyLogic: () => {
        throw new Error('boom');
      },
    };
    assert.equal(evalTabReadOnly(tab, { id: '1' }), false);
  });
});

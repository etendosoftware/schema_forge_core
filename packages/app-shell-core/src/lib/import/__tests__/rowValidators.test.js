import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { registerImportRowValidator, getImportRowValidator, runImportRowValidator } from '../rowValidators.js';

describe('rowValidators', () => {
  it('returns no errors when the descriptor registers no validator', () => {
    assert.deepEqual(runImportRowValidator('not-registered', { a: 1 }), []);
    assert.deepEqual(runImportRowValidator(undefined, { a: 1 }), []);
    assert.equal(getImportRowValidator('not-registered'), undefined);
  });

  it('runs the registered validator and returns its errors', () => {
    registerImportRowValidator('demo-ok', (row) => (
      row.type === 'bad' ? [{ target: 'type', message: 'nope' }] : []
    ));
    assert.deepEqual(runImportRowValidator('demo-ok', { type: 'bad' }), [{ target: 'type', message: 'nope' }]);
    assert.deepEqual(runImportRowValidator('demo-ok', { type: 'good' }), []);
  });

  it('passes translate and config through to the validator', () => {
    let seen = null;
    registerImportRowValidator('demo-ctx', (row, ctx) => { seen = ctx; return []; });
    const translate = () => 'x';
    runImportRowValidator('demo-ctx', {}, { translate, config: { spec: 'product' } });
    assert.equal(seen.translate, translate);
    assert.deepEqual(seen.config, { spec: 'product' });
  });

  it('turns a thrown validator into a row-level error instead of taking the pass down', () => {
    // One malformed cell must fail its own row, never the whole review pass — the file
    // may have 5000 other rows that are perfectly fine.
    registerImportRowValidator('demo-throws', () => { throw new Error('boom'); });
    assert.deepEqual(runImportRowValidator('demo-throws', {}), [{ target: '', message: 'boom' }]);
  });

  it('treats a validator returning nothing as "no errors"', () => {
    registerImportRowValidator('demo-void', () => undefined);
    assert.deepEqual(runImportRowValidator('demo-void', {}), []);
  });
});

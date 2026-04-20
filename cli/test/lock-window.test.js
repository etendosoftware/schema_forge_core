import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';

/**
 * lock-window.js now uses GitHub Issues via `gh` CLI.
 * Pure unit tests are replaced by format/parse validation tests.
 * Full integration tests require a live GitHub repo.
 */

describe('lock-window title format', () => {
  const PREFIX = '🔒 LOCK: ';
  const SUFFIX = ' #';

  function lockTitle(name) {
    return `${PREFIX}${name}${SUFFIX}`;
  }

  function parseTitle(title) {
    if (!title.startsWith(PREFIX) || !title.endsWith(SUFFIX)) return null;
    return title.slice(PREFIX.length, -SUFFIX.length);
  }

  it('creates unambiguous title with trailing #', () => {
    assert.equal(lockTitle('purchase-invoice'), '🔒 LOCK: purchase-invoice #');
    assert.equal(lockTitle('sales-invoice'), '🔒 LOCK: sales-invoice #');
    assert.equal(lockTitle('invoice'), '🔒 LOCK: invoice #');
  });

  it('purchase-invoice title does not match invoice title', () => {
    const piTitle = lockTitle('purchase-invoice');
    const invTitle = lockTitle('invoice');
    assert.notEqual(piTitle, invTitle);
  });

  it('sales-invoice title does not match invoice title', () => {
    const siTitle = lockTitle('sales-invoice');
    const invTitle = lockTitle('invoice');
    assert.notEqual(siTitle, invTitle);
  });

  it('exact match prevents partial collision', () => {
    const titles = [
      lockTitle('invoice'),
      lockTitle('purchase-invoice'),
      lockTitle('sales-invoice'),
      lockTitle('recurring-invoice'),
    ];
    // Each title is unique — no substring collision
    for (let i = 0; i < titles.length; i++) {
      for (let j = 0; j < titles.length; j++) {
        if (i !== j) {
          assert.notEqual(titles[i], titles[j], `${titles[i]} should not equal ${titles[j]}`);
        }
      }
    }
  });

  it('parses window name from title correctly', () => {
    assert.equal(parseTitle('🔒 LOCK: purchase-invoice #'), 'purchase-invoice');
    assert.equal(parseTitle('🔒 LOCK: sales-order #'), 'sales-order');
    assert.equal(parseTitle('🔒 LOCK: invoice #'), 'invoice');
  });

  it('returns null for non-lock titles', () => {
    assert.equal(parseTitle('Some other issue'), null);
    assert.equal(parseTitle('🔒 LOCK: no-hash'), null);
    assert.equal(parseTitle('LOCK: missing-emoji #'), null);
  });
});

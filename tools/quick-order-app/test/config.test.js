import { test } from 'node:test';
import assert from 'node:assert/strict';
import { configFromLocation } from '../src/config.js';

test('defaults to sales when type missing', () => {
  const cfg = configFromLocation('');
  assert.equal(cfg.type, 'sales');
  assert.equal(cfg.headerPath, '/neo/sales-order/sales-order');
});

test('picks purchase config when type=purchase', () => {
  const cfg = configFromLocation('?type=purchase');
  assert.equal(cfg.type, 'purchase');
  assert.equal(cfg.linesPath, '/neo/purchase-order/purchase-order-line');
});

test('throws on unknown type', () => {
  assert.throws(() => configFromLocation('?type=rental'), /Unknown quick-order type: rental/);
});

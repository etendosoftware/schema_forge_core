import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolvePublicApiSchema } from '../src/generate-public-api-schema.js';
import { readFileSync } from 'node:fs';

test('resolves only publicApi-exposed fields into the flat allowlist', () => {
  const productContract = JSON.parse(
    readFileSync(new URL('./fixtures/public-api/contract-product.json', import.meta.url))
  );
  const result = resolvePublicApiSchema({
    apiVersion: 'v1',
    windows: [{ entityName: 'product', contract: productContract }],
  });
  assert.equal(result.apiVersion, 'v1');
  assert.ok(result.entities.product);
  assert.deepEqual(Object.keys(result.entities.product.fields).sort(), ['name', 'searchKey']);
  assert.equal(result.entities.product.fields.name.direction, 'out');
});

test('a field without publicApi never appears in the resolved schema', () => {
  const productContract = JSON.parse(
    readFileSync(new URL('./fixtures/public-api/contract-product.json', import.meta.url))
  );
  const result = resolvePublicApiSchema({
    apiVersion: 'v1',
    windows: [{ entityName: 'product', contract: productContract }],
  });
  assert.equal(result.entities.product.fields.internalCostBasis, undefined);
});

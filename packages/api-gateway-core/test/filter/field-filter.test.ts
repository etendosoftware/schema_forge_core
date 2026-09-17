import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filterInboundParams, filterOutboundRecord, UnknownFieldError } from '../../src/filter/field-filter.ts';
import type { PublicApiEntity } from '../../src/types.ts';

const productEntity: PublicApiEntity = {
  publicApi: true,
  specName: 'product',
  operations: ['GET', 'LIST'],
  fields: {
    name: { publicApi: true, direction: 'out', internalPath: 'name', type: 'passthrough', handlerId: null },
    searchKey: { publicApi: true, direction: 'out', internalPath: 'searchKey', type: 'passthrough', handlerId: null },
  },
};

test('filterOutboundRecord keeps only allowlisted fields', () => {
  const record = { name: 'Widget', searchKey: 'WID-1', internalCostBasis: 42 };
  const result = filterOutboundRecord(productEntity, record);
  assert.deepEqual(result, { name: 'Widget', searchKey: 'WID-1' });
});

test('filterInboundParams rejects an unlisted field with UnknownFieldError', () => {
  assert.throws(
    () => filterInboundParams(productEntity, { name: 'Widget', internalCostBasis: 42 }),
    UnknownFieldError
  );
});

test('filterInboundParams passes through allowlisted params unchanged', () => {
  const result = filterInboundParams(productEntity, { searchKey: 'WID-1' });
  assert.deepEqual(result, { searchKey: 'WID-1' });
});

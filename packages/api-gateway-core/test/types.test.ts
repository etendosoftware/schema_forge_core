import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { PublicApiSchema } from '../src/types.ts';

test('a resolved schema literal matches the PublicApiSchema shape', () => {
  const schema: PublicApiSchema = {
    apiVersion: 'v1',
    entities: {
      product: {
        publicApi: true,
        specName: 'product',
        operations: ['GET', 'LIST'],
        fields: {
          name: {
            publicApi: true,
            direction: 'out',
            internalPath: 'name',
            type: 'passthrough',
            handlerId: null,
          },
        },
      },
    },
  };
  assert.equal(schema.entities.product.fields.name.direction, 'out');
});

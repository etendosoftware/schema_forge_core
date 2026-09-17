import { test } from 'node:test';
import assert from 'node:assert/strict';
import { of } from 'rxjs';
import { firstValueFrom } from 'rxjs';
import { FieldFilterInterceptor, PUBLIC_API_SCHEMA } from '../../src/http/field-filter.interceptor.ts';
import type { PublicApiSchema } from '../../src/types.ts';

const schema: PublicApiSchema = {
  apiVersion: 'v1',
  entities: {
    product: {
      publicApi: true,
      specName: 'product',
      operations: ['GET', 'LIST'],
      fields: {
        name: { publicApi: true, direction: 'out', internalPath: 'name', type: 'passthrough', handlerId: null },
      },
    },
  },
};

test('interceptor strips fields not in the allowlist from a single-record response', async () => {
  const interceptor = new FieldFilterInterceptor(schema);
  const context = {
    getHandler: () => ({ __publicApiEntityName: 'product' }),
    switchToHttp: () => ({ getResponse: () => ({}) }),
  } as any;
  const next = { handle: () => of({ name: 'Widget', internalCostBasis: 42 }) } as any;
  const result = await firstValueFrom(interceptor.intercept(context, next));
  assert.deepEqual(result, { name: 'Widget' });
});

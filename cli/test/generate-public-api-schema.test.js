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

test('stamps specName onto the resolved entity, distinct from entityName (ETP-5345)', () => {
  // NeoServlet's real URL pattern is /sws/neo/{specName}/{entityName} — for a
  // composite window like contacts, the artifact/spec directory name ("contacts")
  // differs from the AD entity name ("businessPartner"), so the resolved schema
  // must carry both, not just the entity name, or the gateway can't build a
  // working NeoServlet URL for any window whose spec name != entity name.
  const businessPartnerContract = JSON.parse(
    readFileSync(new URL('./fixtures/public-api/contract-business-partner.json', import.meta.url))
  );
  const result = resolvePublicApiSchema({
    apiVersion: 'v1',
    windows: [{ entityName: 'businessPartner', specName: 'contacts', contract: businessPartnerContract }],
  });
  assert.equal(result.entities.businessPartner.specName, 'contacts');
});

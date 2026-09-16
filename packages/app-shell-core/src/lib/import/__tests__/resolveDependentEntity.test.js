import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeText,
  deriveCodeFromName,
  resolveOrAutoCreateDependentEntity,
  getResolutionCache,
  clearResolutionCache,
} from '../resolveDependentEntity.js';

describe('resolveDependentEntity', () => {
  describe('normalizeText', () => {
    it('handles accents, casing, and whitespace', () => {
      assert.equal(normalizeText('  Categoría Electrónica  '), 'categoria electronica');
      assert.equal(normalizeText('MÚSICA & ARTE'), 'musica & arte');
      assert.equal(normalizeText(null), '');
      assert.equal(normalizeText(undefined), '');
    });
  });

  describe('deriveCodeFromName', () => {
    it('creates deterministic uppercase slug from name', () => {
      assert.equal(deriveCodeFromName('Laptops & Computadoras'), 'LAPTOPS_COMPUTADORAS');
      assert.equal(deriveCodeFromName('  Categoría 123!  '), 'CATEGORIA_123');
      assert.equal(deriveCodeFromName(''), '');
      assert.equal(deriveCodeFromName(null), '');
    });
  });

  describe('resolveOrAutoCreateDependentEntity', () => {
    const existingRecords = [
      { id: 'CAT-1', searchKey: 'ELEC', name: 'Electrónica' },
      { id: 'CAT-2', searchKey: 'FOOD', name: 'Alimentos' },
      { id: 'CAT-3', searchKey: 'SERV', name: 'Servicios' },
      { id: 'CAT-4', searchKey: 'SERV_DIG', name: 'Servicios' }, // intentional duplicate name for ambiguity test
    ];

    it('returns empty status when no code or name is provided', async () => {
      const res = await resolveOrAutoCreateDependentEntity({ existingRecords });
      assert.equal(res.status, 'empty');
    });

    it('resolves exact match by code / searchKey', async () => {
      const res = await resolveOrAutoCreateDependentEntity({
        code: 'ELEC',
        existingRecords,
      });
      assert.equal(res.status, 'resolved');
      assert.equal(res.id, 'CAT-1');
      assert.equal(res.searchKey, 'ELEC');
    });

    it('resolves normalized match by name when code is not supplied', async () => {
      const res = await resolveOrAutoCreateDependentEntity({
        name: '  electrónica  ',
        existingRecords,
      });
      assert.equal(res.status, 'resolved');
      assert.equal(res.id, 'CAT-1');
    });

    it('resolves normalized match using fallbackValue when only fallback is supplied', async () => {
      const res = await resolveOrAutoCreateDependentEntity({
        fallbackValue: 'Alimentos',
        existingRecords,
      });
      assert.equal(res.status, 'resolved');
      assert.equal(res.id, 'CAT-2');
    });

    it('fails with error status when name is ambiguous (>1 match)', async () => {
      const res = await resolveOrAutoCreateDependentEntity({
        name: 'Servicios',
        existingRecords,
      });
      assert.equal(res.status, 'error');
      assert.equal(res.error.code, 'AMBIGUOUS');
      assert.match(res.error.message, /Multiple records match "Servicios"/);
    });

    it('prepares auto-creation when no match exists and no createFn is provided', async () => {
      const res = await resolveOrAutoCreateDependentEntity({
        name: 'Muebles de Oficina',
        existingRecords,
      });
      assert.equal(res.status, 'pending-create');
      assert.equal(res.searchKey, 'MUEBLES_DE_OFICINA');
      assert.equal(res.name, 'Muebles de Oficina');
      assert.deepEqual(res.createBody, {
        searchKey: 'MUEBLES_DE_OFICINA',
        name: 'Muebles de Oficina',
      });
    });

    it('uses explicit code for creation if supplied', async () => {
      const res = await resolveOrAutoCreateDependentEntity({
        code: 'FURN',
        name: 'Muebles',
        existingRecords,
      });
      assert.equal(res.status, 'pending-create');
      assert.equal(res.searchKey, 'FURN');
      assert.equal(res.name, 'Muebles');
    });

    it('executes createFn and returns created status if createFn is provided', async () => {
      let createdCalls = 0;
      const createFn = async ({ searchKey, name }) => {
        createdCalls += 1;
        return { id: 'NEW-CAT-99', searchKey, name };
      };

      const res = await resolveOrAutoCreateDependentEntity({
        name: 'Herramientas',
        existingRecords,
        createFn,
      });
      assert.equal(res.status, 'created');
      assert.equal(res.id, 'NEW-CAT-99');
      assert.equal(createdCalls, 1);
    });

    it('reuses cached resolution within the same run across concurrent calls', async () => {
      const cache = getResolutionCache('test-run-1');
      let createCalls = 0;
      const createFn = async ({ searchKey, name }) => {
        createCalls += 1;
        return { id: `CAT-${searchKey}`, searchKey, name };
      };

      const promises = [
        resolveOrAutoCreateDependentEntity({ name: 'Ferretería', existingRecords, createFn, cache }),
        resolveOrAutoCreateDependentEntity({ name: 'Ferretería', existingRecords, createFn, cache }),
        resolveOrAutoCreateDependentEntity({ name: 'Ferretería', existingRecords, createFn, cache }),
      ];

      const results = await Promise.all(promises);
      assert.equal(createCalls, 1);
      for (const r of results) {
        assert.equal(r.status, 'created');
        assert.equal(r.id, 'CAT-FERRETERIA');
      }
      clearResolutionCache('test-run-1');
    });

    it('rejects auto-creation if derived searchKey conflicts with existing record', async () => {
      const res = await resolveOrAutoCreateDependentEntity({
        name: 'Food', // Derived code will be FOOD, which exists as 'Alimentos'
        existingRecords,
      });
      assert.equal(res.status, 'error');
      assert.equal(res.error.code, 'KEY_CONFLICT');
      assert.match(res.error.message, /conflicts with existing record "Alimentos"/);
    });
  });
});

/**
 * ETP-5227 — the in-run cache exists so that two rows naming the same new category do not both
 * create it. It was also remembering FAILURES, and `clearResolutionCache` is never called
 * anywhere in production code, so one failed creation became that value's permanent answer for
 * the life of the tab: every later row and every retry replayed the identical rejection without
 * ever calling the server again. That is why the reported error survived "reintentar".
 */
describe('resolveDependentEntity — a failed creation is not a cached result', () => {
  const existingRecords = [{ id: 'CAT-ELEC', searchKey: 'ELEC', name: 'Electrónica' }];

  it('retries the creation on the next call instead of replaying the rejection', async () => {
    const cache = getResolutionCache('etp-5227-retry');
    let attempts = 0;
    const createFn = async ({ searchKey, name }) => {
      attempts += 1;
      if (attempts === 1) throw new Error('There is already a Product Category with the same (…)');
      return { id: 'CAT-NEW', searchKey, name };
    };

    await assert.rejects(
      resolveOrAutoCreateDependentEntity({ name: 'Herramientas', existingRecords, createFn, cache }),
      /already a Product Category/,
    );

    // Same value, same cache: the second call must reach createFn again, not the dead promise.
    const second = await resolveOrAutoCreateDependentEntity({
      name: 'Herramientas', existingRecords, createFn, cache,
    });
    assert.equal(attempts, 2);
    assert.equal(second.status, 'created');
    assert.equal(second.id, 'CAT-NEW');
    clearResolutionCache('etp-5227-retry');
  });

  it('still shares ONE creation between concurrent rows naming the same record', async () => {
    // The eviction must not cost the property the cache exists for.
    const cache = getResolutionCache('etp-5227-concurrent');
    let created = 0;
    const createFn = async ({ searchKey, name }) => {
      created += 1;
      return { id: 'CAT-ONE', searchKey, name };
    };

    const results = await Promise.all([1, 2, 3].map(() => resolveOrAutoCreateDependentEntity({
      name: 'Herramientas', existingRecords, createFn, cache,
    })));

    assert.equal(created, 1);
    for (const result of results) assert.equal(result.id, 'CAT-ONE');
    clearResolutionCache('etp-5227-concurrent');
  });
});

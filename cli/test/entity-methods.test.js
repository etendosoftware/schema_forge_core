/**
 * Tests for cli/src/lib/entity-methods.js — the per-entity HTTP method resolver
 * shared by generate-contract, push-to-neo (live DB) and lib/neo-delta (XML
 * delta). ETP-4254.
 */
import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  applyMethodsToCrudPrediction,
  canonicalizeMethod,
  contractFallbackMethods,
  methodsToWriterFlags,
  methodsToXmlFlags,
  NEO_HTTP_METHODS,
  NEO_READ_METHODS,
  normalizeMethodList,
  resolveContractEntityMethods,
  resolveEntityHideDelete,
  resolveEntityMethods,
  sameMethods,
} from '../src/lib/entity-methods.js';

const ALL = ['GET', 'GETBYID', 'POST', 'PUT', 'PATCH', 'DELETE'];
const READ = ['GET', 'GETBYID'];

// ---------------------------------------------------------------------------
// resolveEntityMethods — the declaration layer
// ---------------------------------------------------------------------------

describe('resolveEntityMethods', () => {
  it('defaults to all six methods when nothing is declared', () => {
    assert.deepEqual(resolveEntityMethods(), ALL);
    assert.deepEqual(resolveEntityMethods({}), ALL);
    assert.deepEqual(
      resolveEntityMethods({ windowReadOnly: false, entityReadOnly: undefined, entityMethods: undefined }),
      ALL,
    );
  });

  it('window-level readOnly makes every entity read-only', () => {
    assert.deepEqual(resolveEntityMethods({ windowReadOnly: true }), READ);
  });

  it('per-entity readOnly makes just that entity read-only', () => {
    assert.deepEqual(resolveEntityMethods({ entityReadOnly: true }), READ);
    // ...and leaves a sibling entity of the same window untouched
    assert.deepEqual(resolveEntityMethods({ entityReadOnly: undefined }), ALL);
  });

  it('per-entity readOnly:false overrides a read-only window (mixed window)', () => {
    assert.deepEqual(
      resolveEntityMethods({ windowReadOnly: true, entityReadOnly: false }),
      ALL,
    );
  });

  it('per-entity readOnly:true overrides a writable window', () => {
    assert.deepEqual(
      resolveEntityMethods({ windowReadOnly: false, entityReadOnly: true }),
      READ,
    );
  });

  it('per-entity methods allowlist wins over both readOnly levels', () => {
    assert.deepEqual(
      resolveEntityMethods({
        windowReadOnly: true,
        entityReadOnly: true,
        entityMethods: ['GET', 'PUT', 'PATCH'],
      }),
      ['GET', 'GETBYID', 'PUT', 'PATCH'],
    );
  });

  it('always grants GET + GETBYID, whatever is declared', () => {
    // Write-only allowlist
    assert.deepEqual(
      resolveEntityMethods({ entityMethods: ['POST', 'DELETE'] }),
      ['GET', 'GETBYID', 'POST', 'DELETE'],
    );
    // Empty allowlist — the old includeAllMethods=false bug (no read access)
    assert.deepEqual(resolveEntityMethods({ entityMethods: [] }), READ);
    // Garbage allowlist
    assert.deepEqual(resolveEntityMethods({ entityMethods: ['NOPE', 42, null] }), READ);
    // Every resolution path grants reads
    for (const intent of [
      {},
      { windowReadOnly: true },
      { entityReadOnly: true },
      { entityReadOnly: false },
      { entityMethods: ['PUT'] },
    ]) {
      const methods = resolveEntityMethods(intent);
      for (const read of NEO_READ_METHODS) {
        assert.ok(methods.includes(read), `${read} missing for ${JSON.stringify(intent)}`);
      }
    }
  });

  it('returns canonically ordered, deduplicated lists', () => {
    assert.deepEqual(
      resolveEntityMethods({ entityMethods: ['delete', 'PUT', 'put', 'GET_BY_ID', 'getById'] }),
      ['GET', 'GETBYID', 'PUT', 'DELETE'],
    );
  });
});

// ---------------------------------------------------------------------------
// Token normalization
// ---------------------------------------------------------------------------

describe('canonicalizeMethod / normalizeMethodList', () => {
  it('accepts case and separator variants of GETBYID', () => {
    for (const raw of ['GETBYID', 'getById', 'get_by_id', 'GET-BY-ID', ' getbyid ']) {
      assert.equal(canonicalizeMethod(raw), 'GETBYID', raw);
    }
  });

  it('rejects unknown tokens and non-strings', () => {
    for (const raw of ['HEAD', 'OPTIONS', '', 42, null, undefined, {}]) {
      assert.equal(canonicalizeMethod(raw), null, String(raw));
    }
  });

  it('returns null for a non-array so callers can tell "undeclared" from "read-only"', () => {
    assert.equal(normalizeMethodList(undefined), null);
    assert.equal(normalizeMethodList(null), null);
    assert.equal(normalizeMethodList('GET'), null);
    assert.deepEqual(normalizeMethodList([]), READ);
  });
});

// ---------------------------------------------------------------------------
// Flag projections — the two write paths must produce equivalent rows
// ---------------------------------------------------------------------------

describe('flag projections', () => {
  it('methodsToWriterFlags maps to the upsertEntity params', () => {
    assert.deepEqual(methodsToWriterFlags(ALL), {
      isGet: 'Y', isGetbyid: 'Y', isPost: 'Y', isPut: 'Y', isPatch: 'Y', isDelete: 'Y',
    });
    assert.deepEqual(methodsToWriterFlags(READ), {
      isGet: 'Y', isGetbyid: 'Y', isPost: 'N', isPut: 'N', isPatch: 'N', isDelete: 'N',
    });
  });

  it('methodsToXmlFlags maps to the ETGO_SF_ENTITY columns', () => {
    assert.deepEqual(methodsToXmlFlags(ALL), {
      ISGET: 'Y', ISGETBYID: 'Y', ISPOST: 'Y', ISPUT: 'Y', ISPATCH: 'Y', ISDELETE: 'Y',
    });
    assert.deepEqual(methodsToXmlFlags(READ), {
      ISGET: 'Y', ISGETBYID: 'Y', ISPOST: 'N', ISPUT: 'N', ISPATCH: 'N', ISDELETE: 'N',
    });
  });

  it('the two projections always agree method-for-method', () => {
    const cases = [ALL, READ, ['GET', 'GETBYID', 'PUT'], ['GET', 'GETBYID', 'POST', 'DELETE']];
    const pairs = [
      ['isGet', 'ISGET'], ['isGetbyid', 'ISGETBYID'], ['isPost', 'ISPOST'],
      ['isPut', 'ISPUT'], ['isPatch', 'ISPATCH'], ['isDelete', 'ISDELETE'],
    ];
    for (const methods of cases) {
      const writer = methodsToWriterFlags(methods);
      const xml = methodsToXmlFlags(methods);
      for (const [w, x] of pairs) {
        assert.equal(writer[w], xml[x], `${w}/${x} diverged for ${methods.join(',')}`);
      }
    }
  });

  it('never projects a row without read access', () => {
    const flags = methodsToWriterFlags(resolveEntityMethods({ entityMethods: [] }));
    assert.equal(flags.isGet, 'Y');
    assert.equal(flags.isGetbyid, 'Y');
  });
});

describe('sameMethods / contractFallbackMethods', () => {
  it('compares canonical lists', () => {
    assert.ok(sameMethods(ALL, [...NEO_HTTP_METHODS]));
    assert.ok(!sameMethods(ALL, READ));
    assert.ok(!sameMethods(READ, ['GET', 'GETBYID', 'PUT']));
  });

  it('falls back to read-only for a read-only window, all methods otherwise', () => {
    assert.deepEqual(contractFallbackMethods(true), READ);
    assert.deepEqual(contractFallbackMethods(false), ALL);
    assert.deepEqual(contractFallbackMethods(undefined), ALL);
  });
});

// ---------------------------------------------------------------------------
// Contract projection + read-back (what push-to-neo / neo-delta consume)
// ---------------------------------------------------------------------------

describe('applyMethodsToCrudPrediction', () => {
  const baseCrud = () => ({
    get: true, getById: true, post: true, put: true, patch: true, delete: true,
  });

  it('emits no methods key for an unrestricted entity (zero contract churn)', () => {
    const crud = applyMethodsToCrudPrediction(baseCrud(), ALL);
    assert.equal(crud.methods, undefined);
    assert.deepEqual(crud, baseCrud());
  });

  it('emits no methods key for a plain read-only window (window flag covers it)', () => {
    const crud = applyMethodsToCrudPrediction(baseCrud(), READ, { windowReadOnly: true });
    assert.equal(crud.methods, undefined);
    assert.equal(crud.post, false);
    assert.equal(crud.delete, false);
    assert.equal(crud.get, true);
  });

  it('pins the entity that opts OUT of a read-only window', () => {
    const crud = applyMethodsToCrudPrediction(baseCrud(), ALL, { windowReadOnly: true });
    assert.deepEqual(crud.methods, ALL);
  });

  it('emits methods for a per-entity restriction on a writable window', () => {
    const crud = applyMethodsToCrudPrediction(baseCrud(), READ);
    assert.deepEqual(crud.methods, READ);
    assert.equal(crud.put, false);
  });

  it('only ever disables — an existing hideDelete opt-out survives', () => {
    const crud = { ...baseCrud(), delete: false };
    applyMethodsToCrudPrediction(crud, ALL);
    assert.equal(crud.delete, false, 'window/entity hideDelete must not be re-enabled');
  });
});

describe('resolveContractEntityMethods', () => {
  it('reads the explicit allowlist', () => {
    const contract = { apiPrediction: { crud: { log: { methods: ['GET', 'PUT'] } } } };
    assert.deepEqual(resolveContractEntityMethods(contract, 'log'), ['GET', 'GETBYID', 'PUT']);
  });

  it('falls back to the window flag for entities with no methods key', () => {
    const contract = { apiPrediction: { window: { readOnly: true }, crud: { log: {} } } };
    assert.deepEqual(resolveContractEntityMethods(contract, 'log'), READ);
    // ...including AD tabs that have no contract entity at all
    assert.deepEqual(resolveContractEntityMethods(contract, 'notInContract'), READ);
  });

  it('falls back to all methods for a contract that declares nothing', () => {
    assert.deepEqual(resolveContractEntityMethods({}, 'log'), ALL);
    assert.deepEqual(resolveContractEntityMethods(null, 'log'), ALL);
    assert.deepEqual(
      resolveContractEntityMethods({ apiPrediction: { crud: { log: {} } } }, 'log'),
      ALL,
    );
  });

  it('repairs a hand-edited contract that dropped read access', () => {
    const contract = { apiPrediction: { crud: { log: { methods: ['POST'] } } } };
    assert.deepEqual(resolveContractEntityMethods(contract, 'log'), ['GET', 'GETBYID', 'POST']);
  });

  // ETP-4745 — `crud.<entity>.delete === false` (window.hideDelete /
  // entities.<key>.hideDelete) must fold into the resolved method list, or the
  // live DB / XML delta keep granting DELETE while the frontend hides it.
  it('drops DELETE when crud.<entity>.delete is false, unrestricted entity', () => {
    const contract = { apiPrediction: { crud: { log: { delete: false } } } };
    assert.deepEqual(resolveContractEntityMethods(contract, 'log'), ['GET', 'GETBYID', 'POST', 'PUT', 'PATCH']);
  });

  it('drops DELETE from an explicit methods allowlist that still included it', () => {
    const contract = {
      apiPrediction: { crud: { log: { methods: ['GET', 'PUT', 'DELETE'], delete: false } } },
    };
    assert.deepEqual(resolveContractEntityMethods(contract, 'log'), ['GET', 'GETBYID', 'PUT']);
  });

  it('preserves DELETE by default when crud.<entity>.delete is true or absent', () => {
    const trueCase = { apiPrediction: { crud: { log: { delete: true } } } };
    const absentCase = { apiPrediction: { crud: { log: {} } } };
    assert.deepEqual(resolveContractEntityMethods(trueCase, 'log'), ALL);
    assert.deepEqual(resolveContractEntityMethods(absentCase, 'log'), ALL);
  });

  it('is a no-op on an already read-only entity (nothing left to drop)', () => {
    const contract = {
      apiPrediction: { window: { readOnly: true }, crud: { log: { delete: false } } },
    };
    assert.deepEqual(resolveContractEntityMethods(contract, 'log'), READ);
  });
});

// ---------------------------------------------------------------------------
// resolveEntityHideDelete — ETP-4745, the declaration-side counterpart used by
// generate-contract.js (before a contract exists) and the F21 validator rule
// (to compute the same "expected" outcome independently of the contract).
// ---------------------------------------------------------------------------

describe('resolveEntityHideDelete', () => {
  it('defaults to false when nothing is declared', () => {
    assert.equal(resolveEntityHideDelete(), false);
    assert.equal(resolveEntityHideDelete({}), false);
  });

  it('entity-level hideDelete always wins', () => {
    assert.equal(resolveEntityHideDelete({ entityHideDelete: true }), true);
    assert.equal(
      resolveEntityHideDelete({ windowReadOnly: true, entityReadOnly: false, entityHideDelete: true }),
      true,
      'an entity-level hideDelete is not overridable by opting out of a read-only window',
    );
  });

  it('window-level hideDelete drops DELETE for every entity by default', () => {
    assert.equal(resolveEntityHideDelete({ windowHideDelete: true }), true);
  });

  it('window.readOnly implies windowHideDelete is honored the same way', () => {
    assert.equal(resolveEntityHideDelete({ windowReadOnly: true, windowHideDelete: true }), true);
  });

  it('entities.<key>.readOnly:false fully opts an entity out of window hideDelete', () => {
    assert.equal(
      resolveEntityHideDelete({ windowReadOnly: true, windowHideDelete: true, entityReadOnly: false }),
      false,
    );
  });

  it('the readOnly:false opt-out only applies when windowReadOnly is true', () => {
    // A standalone `window.hideDelete` (no `window.readOnly`) has no opt-out —
    // `entityReadOnly: false` means nothing here because there was no read-only
    // window to opt out of in the first place.
    assert.equal(
      resolveEntityHideDelete({ windowReadOnly: false, windowHideDelete: true, entityReadOnly: false }),
      true,
    );
  });
});

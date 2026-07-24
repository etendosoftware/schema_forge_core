import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { classifyImportError, sendRow, SEND_STATUS } from '../importEngine.js';

// ETP-4669: importEngine now classifies raw backend diagnostics into stable, translatable
// error KINDS and never surfaces the raw text as the user-facing message (it moves to
// error.raw). The existing importEngine.test.js covers the English-fallback path (no
// translator); these cover the classifier directly and the translator-injected path — the
// two behaviors the two-repo wiring depends on but that were previously untested here.

describe('classifyImportError', () => {
  it('maps a Postgres not-null column violation to a required-field kind with a readable field name', () => {
    const c = classifyImportError('null value in column "commercial_name" of relation "c_bpartner" violates not-null constraint');
    assert.equal(c.key, 'importErrorRequiredField');
    assert.equal(c.params.field, 'Commercial Name');
    assert.equal(c.duplicate, false);
  });

  it('maps a bare not-null constraint (no column captured) to the generic required kind', () => {
    const c = classifyImportError('ERROR: violates not-null constraint');
    assert.equal(c.key, 'importErrorRequiredGeneric');
    assert.equal(c.duplicate, false);
  });

  it('maps a Postgres unique-index violation to the duplicate kind (benign, retry-proof)', () => {
    const c = classifyImportError('duplicate key value violates unique constraint "c_bpartner_value_uk"');
    assert.equal(c.key, 'importErrorDuplicate');
    assert.equal(c.duplicate, true);
  });

  it('maps Etendo\'s AD-level uniqueness message (English and Spanish) to the duplicate-identifier kind', () => {
    const en = classifyImportError('There is already a Business Partner with the same (Client, Organization, Search Key). (Client, Organization, Search Key) must be unique.');
    const es = classifyImportError('Ya existe un Tercero con la misma (Cliente, Organización, Clave de búsqueda). (Cliente, Organización, Clave de búsqueda) debe ser único.');
    assert.equal(en.key, 'importErrorDuplicateIdentifier');
    assert.equal(en.duplicate, true);
    assert.equal(es.key, 'importErrorDuplicateIdentifier');
    assert.equal(es.duplicate, true);
  });

  it('maps a value-too-long validation to its own kind', () => {
    const c = classifyImportError('Value too long. Length 48, maximum allowed 40');
    assert.equal(c.key, 'importErrorValueTooLong');
    assert.equal(c.duplicate, false);
  });

  it('falls through to the generic kind for an uncontrolled backend leak (never a partial match on internal noise)', () => {
    const c = classifyImportError('Invalid value for OBTIKTaxIDKey: com.etendoerp.redis.interfaces.CachedSet@55b0cf12');
    assert.equal(c.key, 'importErrorGeneric');
    assert.equal(c.duplicate, false);
  });

  it('is total over non-string input — a null/undefined/number diagnostic classifies as generic, never throws', () => {
    for (const bad of [null, undefined, 42, {}, []]) {
      const c = classifyImportError(bad);
      assert.equal(c.key, 'importErrorGeneric');
      assert.equal(c.duplicate, false);
    }
  });
});

// A translator echoing a small Spanish table; returning the key unchanged is the "missing
// key" signal the engine's fallback guard checks for.
const es = {
  importErrorRequiredField: (p) => `El campo "${p.field}" es obligatorio.`,
  importErrorDuplicateIdentifier: () => 'Ya existe un registro con este identificador.',
  importErrorValueTooLong: () => 'Un valor es demasiado largo.',
  importErrorGeneric: () => 'No se pudo importar esta fila. Abra el detalle para ver el reporte técnico.',
};
const translate = (key, params) => (es[key] ? es[key](params ?? {}) : key);

describe('sendRow — translator-injected friendly messages', () => {
  it('localizes a classified required-field error and interpolates the field name, keeping the raw text on error.raw', async () => {
    const rawText = 'null value in column "value" of relation "c_bpartner" violates not-null constraint';
    const postBatch = async () => ({ committed: false, error: { message: rawText } });
    const result = await sendRow([{ id: 'row' }], { postBatch, translate });
    assert.equal(result.status, SEND_STATUS.FAILED);
    assert.equal(result.error.message, 'El campo "Value" es obligatorio.');
    assert.ok(result.error.raw.includes('null value in column'), `expected raw to keep the backend text, got: ${result.error.raw}`);
  });

  it('localizes an uncontrolled leak to the generic message — the raw CachedSet text never reaches the user but stays on error.raw', async () => {
    const postBatch = async () => ({ message: 'Invalid value for OBTIKTaxIDKey: com.etendoerp.redis.interfaces.CachedSet@1a2b3c' });
    const result = await sendRow([{ id: 'row' }], { postBatch, translate });
    assert.equal(result.status, SEND_STATUS.FAILED);
    assert.equal(result.error.message, es.importErrorGeneric());
    assert.ok(!result.error.message.includes('CachedSet'), `expected no raw leak in the message, got: ${result.error.message}`);
    assert.ok(result.error.raw.includes('CachedSet'), `expected raw to keep the backend text, got: ${result.error.raw}`);
  });

  it('localizes a unique-constraint rejection as a DUPLICATE with a friendly identifier message', async () => {
    const postBatch = async () => ({
      committed: false,
      error: { message: "Operation 'bp' rejected by server", detail: { error: { message: 'There is already a Business Partner with the same (Client, Organization, Search Key). (Client, Organization, Search Key) must be unique.' } } },
    });
    const result = await sendRow([{ id: 'bp' }], { postBatch, translate });
    assert.equal(result.status, SEND_STATUS.DUPLICATE);
    assert.equal(result.error.message, 'Ya existe un registro con este identificador.');
    assert.ok(!result.error.message.includes('Business Partner'), `expected no raw AD text leak, got: ${result.error.message}`);
    assert.ok(result.error.raw.includes('must be unique'), `expected raw to keep the backend text, got: ${result.error.raw}`);
  });

  it('falls back to the English default when the injected translator has no entry for the classified key (returns the key unchanged)', async () => {
    // A translator that resolves NOTHING (echoes every key) must not leak the bare key as the
    // user-facing message — the engine detects `translated === key` and uses its English default.
    const echoKey = (key) => key;
    const postBatch = async () => ({ message: 'some unrecognized backend failure' });
    const result = await sendRow([{ id: 'row' }], { postBatch, translate: echoKey });
    assert.equal(result.status, SEND_STATUS.FAILED);
    assert.notEqual(result.error.message, 'importErrorGeneric');
    assert.match(result.error.message, /could not be imported/i);
  });

  it('with no translator injected, uses the English fallback table and still interpolates params', async () => {
    const postBatch = async () => ({ committed: false, error: { message: 'null value in column "search_key" of relation "c_bpartner" violates not-null constraint' } });
    const result = await sendRow([{ id: 'row' }], { postBatch });
    assert.equal(result.status, SEND_STATUS.FAILED);
    assert.equal(result.error.message, 'The field "Search Key" is required.');
    assert.ok(result.error.raw.includes('null value in column'), `expected raw to keep the backend text, got: ${result.error.raw}`);
  });
});

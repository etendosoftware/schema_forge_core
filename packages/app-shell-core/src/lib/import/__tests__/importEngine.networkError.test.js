import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { classifyTransportError, sendRow, SEND_STATUS } from '../importEngine.js';

/**
 * ETP-5424 — apiFetch now throws a NetworkError for a dropped connection, and that error
 * carries its own `messageKey` ('networkErrorRetry'). `classifyTransportError` lets any
 * `messageKey` win over prose, so without an explicit rule the importer would stop
 * reporting its own connection message and show the generic apiFetch one instead.
 *
 * Loaded lazily so each case fails on its own while the module does not exist yet, rather
 * than the whole file failing to link.
 */
async function networkError(reason = 'offline') {
  const { NetworkError } = await import('../../../auth/networkError.js');
  return new NetworkError({ reason, cause: new TypeError('Failed to fetch') });
}

describe('classifyTransportError — NetworkError (ETP-5424)', () => {
  it('classifies an offline NetworkError as importErrorConnection, not its own messageKey', async () => {
    assert.deepEqual(classifyTransportError(await networkError('offline')), {
      key: 'importErrorConnection', params: {},
    });
  });

  it('classifies a timeout NetworkError as importErrorTimeout (the key IMPORT_ERROR_FALLBACKS already has)', async () => {
    assert.deepEqual(classifyTransportError(await networkError('timeout')), {
      key: 'importErrorTimeout', params: {},
    });
  });

  it('recognizes the NetworkError shape by its code, not by class identity', () => {
    const foreign = new Error('No se pudo completar la acción. Inténtalo de nuevo.');
    foreign.name = 'NetworkError';
    foreign.code = 'NETWORK';
    foreign.messageKey = 'networkErrorRetry';
    assert.deepEqual(classifyTransportError(foreign), { key: 'importErrorConnection', params: {} });
  });

  it('still lets any other thrower-declared messageKey win', () => {
    const err = new Error('Batch failed (503)');
    err.messageKey = 'importErrorServerFailure';
    err.params = { status: 503 };
    assert.deepEqual(classifyTransportError(err), {
      key: 'importErrorServerFailure', params: { status: 503 },
    });
  });

  it('sendRow shows the importer connection message for a NetworkError rejection', async () => {
    const translations = { importErrorConnection: 'No se pudo conectar con el servidor.' };
    const translate = (key) => translations[key] ?? key;
    const err = await networkError('offline');
    const postBatch = async () => { throw err; };
    const result = await sendRow([{ id: 'row' }], { postBatch, translate });
    assert.equal(result.status, SEND_STATUS.UNKNOWN);
    assert.equal(result.error.message, 'No se pudo conectar con el servidor.');
  });
});

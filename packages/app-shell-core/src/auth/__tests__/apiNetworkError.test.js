import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  apiFetch, createApiFetch, registerApiSession, resetApiSessionForTests,
  resetRecordWriteChainsForTests,
} from '../api.js';
import { resetSessionCredentials } from '../sessionCredentials.js';
import { resetRecordVersionsForTests } from '../../lib/recordVersions.js';

/**
 * ETP-5424 — a transport failure leaves apiFetch as a NetworkError whose `.message` is
 * already the localized, user-facing text, instead of the browser's
 * `TypeError('Failed to fetch')` that ~150 sites rendered verbatim.
 *
 * The networkError module is loaded lazily so that, while it does not exist yet, each case
 * below fails on its own behaviour instead of the whole file failing to link.
 */
async function loadNetworkError() {
  return import('../networkError.js');
}

const TRANSLATED = 'No se pudo completar la acción. Inténtalo de nuevo.';
const FALLBACK = 'Could not complete the action. Try again.';

const originalFetch = globalThis.fetch;

beforeEach(() => {
  resetRecordWriteChainsForTests();
  resetRecordVersionsForTests();
  resetApiSessionForTests();
  resetSessionCredentials();
});

afterEach(async () => {
  globalThis.fetch = originalFetch;
  resetRecordWriteChainsForTests();
  resetRecordVersionsForTests();
  resetApiSessionForTests();
  try {
    (await loadNetworkError()).resetErrorTranslatorForTests();
  } catch {
    // Module not there yet — nothing was registered.
  }
});

/** A client with no session scope, the shape a plain module gets. */
const client = () => createApiFetch('', () => null, () => {});

function assertNetworkError(err, reason) {
  assert.equal(err?.name, 'NetworkError', `expected a NetworkError, got ${err?.name}: ${err?.message}`);
  assert.equal(err.code, 'NETWORK');
  assert.equal(err.messageKey, 'networkErrorRetry');
  assert.equal(err.reason, reason);
}

async function rejectionOf(promise) {
  try {
    await promise;
  } catch (err) {
    return err;
  }
  assert.fail('expected the request to reject');
}

/**
 * Like {@link rejectionOf}, but fails the case instead of hanging when the request never
 * settles — without it, a missing timeout leaves the event loop empty and node:test cancels
 * every case that follows in the file.
 */
async function rejectionWithin(promise, ms = 500) {
  let timer;
  const guard = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new assert.AssertionError({
      message: `request still pending after ${ms} ms — no timeout fired`,
    })), ms);
  });
  try {
    return await Promise.race([rejectionOf(promise), guard]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * A fetch that never settles on its own and, like the real one, rejects with the signal's
 * reason when the signal it was handed aborts.
 */
function hangingFetch(calls = []) {
  return (url, options = {}) => {
    calls.push({ url, options });
    return new Promise((_, reject) => {
      const { signal } = options;
      if (!signal) return;
      const abort = () => reject(signal.reason ?? new DOMException('The operation was aborted.', 'AbortError'));
      if (signal.aborted) abort();
      else signal.addEventListener('abort', abort, { once: true });
    });
  };
}

function okResponse(overrides = {}) {
  return {
    ok: true,
    status: 200,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => ({ response: { data: [] } }),
    text: async () => '',
    blob: async () => new Blob([]),
    clone() { return okResponse(overrides); },
    ...overrides,
  };
}

const settleWithin = (promise, ms) => Promise.race([
  promise.then(() => 'resolved', () => 'rejected'),
  new Promise((resolve) => { setTimeout(() => resolve('pending'), ms); }),
]);

describe('apiFetch transport failure → NetworkError (createApiFetch)', () => {
  it('turns the browser TypeError into a NetworkError with reason offline', async () => {
    const cause = new TypeError('Failed to fetch');
    globalThis.fetch = async () => { throw cause; };
    const err = await rejectionOf(client()('/x'));
    assertNetworkError(err, 'offline');
    assert.equal(err.cause, cause);
  });

  it('is an instance of the exported NetworkError class', async () => {
    const { NetworkError } = await loadNetworkError();
    globalThis.fetch = async () => { throw new TypeError('Failed to fetch'); };
    const err = await rejectionOf(client()('/x'));
    assert.ok(err instanceof NetworkError);
  });

  it('carries the English fallback as its message when no translator is registered', async () => {
    globalThis.fetch = async () => { throw new TypeError('Failed to fetch'); };
    const err = await rejectionOf(client()('/x'));
    assert.equal(err.message, FALLBACK);
    assert.doesNotMatch(err.message, /Failed to fetch/);
  });

  it('carries the translated text when a translator is registered', async () => {
    const { registerErrorTranslator } = await loadNetworkError();
    registerErrorTranslator((key) => (key === 'networkErrorRetry' ? TRANSLATED : key));
    globalThis.fetch = async () => { throw new TypeError('Failed to fetch'); };
    const err = await rejectionOf(client()('/x'));
    assert.equal(err.message, TRANSLATED);
  });

  it('also covers a write (POST with a body)', async () => {
    globalThis.fetch = async () => { throw new TypeError('NetworkError when attempting to fetch resource.'); };
    const err = await rejectionOf(client()('/x', { method: 'POST', body: '{}' }));
    assertNetworkError(err, 'offline');
  });

  it('passes a non-TypeError rejection through unchanged', async () => {
    const original = new Error('offline');
    globalThis.fetch = async () => { throw original; };
    const err = await rejectionOf(client()('/x'));
    assert.equal(err, original);
  });

  it('passes the caller\'s own AbortError through unchanged — a cancellation is not a failure', async () => {
    const controller = new AbortController();
    globalThis.fetch = hangingFetch();
    const pending = client()('/x', { signal: controller.signal });
    controller.abort();
    const err = await rejectionOf(pending);
    assert.equal(err.name, 'AbortError');
    assert.notEqual(err.name, 'NetworkError');
    assert.notEqual(err.code, 'NETWORK');
  });

  it('passes an AbortError thrown by fetch through unchanged', async () => {
    const abort = new DOMException('x', 'AbortError');
    globalThis.fetch = async () => { throw abort; };
    const err = await rejectionOf(client()('/x'));
    assert.equal(err, abort);
  });
});

describe('apiFetch timeout', () => {
  it('rejects with a NetworkError reason timeout when the request outlives `timeout`', async () => {
    globalThis.fetch = hangingFetch();
    const err = await rejectionWithin(client()('/x', { timeout: 20 }));
    assertNetworkError(err, 'timeout');
  });

  it('localizes the timeout message like any other network failure', async () => {
    const { registerErrorTranslator } = await loadNetworkError();
    registerErrorTranslator(() => TRANSLATED);
    globalThis.fetch = hangingFetch();
    const err = await rejectionWithin(client()('/x', { timeout: 20 }));
    assert.equal(err.message, TRANSLATED);
  });

  it('aborts the underlying fetch when the timeout fires, so the socket is released', async () => {
    const calls = [];
    globalThis.fetch = hangingFetch(calls);
    await rejectionWithin(client()('/x', { timeout: 20 }));
    const { signal } = calls[0].options;
    assert.ok(signal, 'expected fetch to be handed a signal');
    assert.equal(signal.aborted, true);
  });

  it('applies DEFAULT_API_TIMEOUT_MS when no timeout is given (fetch always gets a signal)', async () => {
    const calls = [];
    globalThis.fetch = async (url, options) => { calls.push(options); return okResponse(); };
    await client()('/x');
    assert.ok(calls[0].signal instanceof AbortSignal, 'expected a timeout signal on every request');
  });

  it('timeout: 0 disables it — a never-resolving fetch stays pending', async () => {
    const controller = new AbortController();
    globalThis.fetch = hangingFetch();
    const pending = client()('/x', { timeout: 0, signal: controller.signal });
    assert.equal(await settleWithin(pending, 60), 'pending');
    controller.abort();
    await pending.catch(() => {});
  });

  it('does not leak `timeout` through to fetch', async () => {
    const calls = [];
    globalThis.fetch = async (url, options) => { calls.push(options); return okResponse(); };
    await client()('/x', { timeout: 5000 });
    assert.equal('timeout' in calls[0], false);
  });

  it('the caller\'s signal still wins alongside a timeout: its abort is an AbortError', async () => {
    const controller = new AbortController();
    globalThis.fetch = hangingFetch();
    const pending = client()('/x', { timeout: 1000, signal: controller.signal });
    setTimeout(() => controller.abort(), 5);
    const err = await rejectionWithin(pending);
    assert.equal(err.name, 'AbortError');
    assert.notEqual(err.code, 'NETWORK');
  });

  it('a caller signal that is already aborted rejects as AbortError, not NetworkError', async () => {
    const controller = new AbortController();
    controller.abort();
    globalThis.fetch = hangingFetch();
    const err = await rejectionWithin(client()('/x', { timeout: 1000, signal: controller.signal }));
    assert.equal(err.name, 'AbortError');
  });

  it('clears the timer on success: the signal handed to fetch never aborts afterwards', async () => {
    const calls = [];
    globalThis.fetch = async (url, options) => { calls.push(options); return okResponse(); };
    const res = await client()('/x', { timeout: 20 });
    assert.equal(res.status, 200);
    await new Promise((resolve) => { setTimeout(resolve, 50); });
    assert.equal(calls[0].signal?.aborted, false);
  });

  it('clears every timer it armed once a successful request settles', async () => {
    const armed = new Set();
    const realSetTimeout = globalThis.setTimeout;
    const realClearTimeout = globalThis.clearTimeout;
    globalThis.setTimeout = (fn, ms, ...args) => {
      const id = realSetTimeout(fn, ms, ...args);
      if (ms === 5000) armed.add(id);
      return id;
    };
    globalThis.clearTimeout = (id) => { armed.delete(id); return realClearTimeout(id); };
    try {
      globalThis.fetch = async () => okResponse();
      await client()('/x', { timeout: 5000 });
    } finally {
      globalThis.setTimeout = realSetTimeout;
      globalThis.clearTimeout = realClearTimeout;
    }
    assert.equal(armed.size, 0, 'a 5000 ms timer was left pending after the request resolved');
  });

  it('a successful response well within the timeout resolves normally', async () => {
    globalThis.fetch = async () => okResponse();
    const res = await client()('/x', { timeout: 1000 });
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { response: { data: [] } });
  });
});

describe('apiFetch body read failure', () => {
  for (const reader of ['json', 'text', 'blob']) {
    it(`res.${reader}() rejecting with a TypeError becomes a NetworkError reason offline`, async () => {
      const cause = new TypeError('network error');
      globalThis.fetch = async () => okResponse({ [reader]: async () => { throw cause; } });
      const res = await client()('/x');
      const err = await rejectionOf(res[reader]());
      assertNetworkError(err, 'offline');
      assert.equal(err.cause, cause);
    });
  }

  it('a SyntaxError from invalid JSON passes through unchanged', async () => {
    const syntax = new SyntaxError('Unexpected token < in JSON at position 0');
    globalThis.fetch = async () => okResponse({ json: async () => { throw syntax; } });
    const res = await client()('/x');
    const err = await rejectionOf(res.json());
    assert.equal(err, syntax);
  });

  it('a successful body read still returns its value', async () => {
    globalThis.fetch = async () => okResponse({ text: async () => 'hello' });
    const res = await client()('/x');
    assert.equal(await res.text(), 'hello');
  });
});

describe('ambient apiFetch transport failure', () => {
  it('turns the browser TypeError into a localized NetworkError', async () => {
    const { registerErrorTranslator } = await loadNetworkError();
    registerErrorTranslator(() => TRANSLATED);
    registerApiSession({ getToken: () => 'tok', baseUrl: '' });
    const cause = new TypeError('Failed to fetch');
    globalThis.fetch = async () => { throw cause; };
    const err = await rejectionOf(apiFetch('/x'));
    assertNetworkError(err, 'offline');
    assert.equal(err.cause, cause);
    assert.equal(err.message, TRANSLATED);
  });

  it('falls back to the English text with no translator and no session', async () => {
    globalThis.fetch = async () => { throw new TypeError('Failed to fetch'); };
    const err = await rejectionOf(apiFetch('/x'));
    assertNetworkError(err, 'offline');
    assert.equal(err.message, FALLBACK);
  });

  it('honours `timeout` too', async () => {
    registerApiSession({ getToken: () => 'tok', baseUrl: '' });
    globalThis.fetch = hangingFetch();
    const err = await rejectionWithin(apiFetch('/x', { timeout: 20 }));
    assertNetworkError(err, 'timeout');
  });

  it('passes a plain Error through unchanged', async () => {
    const original = new Error('offline');
    globalThis.fetch = async () => { throw original; };
    const err = await rejectionOf(apiFetch('/x'));
    assert.equal(err, original);
  });

  it('turns a TypeError body read into a NetworkError', async () => {
    registerApiSession({ getToken: () => 'tok', baseUrl: '' });
    globalThis.fetch = async () => okResponse({ json: async () => { throw new TypeError('network error'); } });
    const res = await apiFetch('/x');
    const err = await rejectionOf(res.json());
    assertNetworkError(err, 'offline');
  });
});

describe('serialized write queue (ETP-5255) and a network failure', () => {
  it('surfaces the failed write as a NetworkError and still runs the next queued write', async () => {
    const request = client();
    let call = 0;
    const bodies = [];
    globalThis.fetch = async (url, options) => {
      call += 1;
      bodies.push(options.body);
      if (call === 1) throw new TypeError('Failed to fetch');
      return okResponse({
        json: async () => ({ response: { data: [{ id: 'r1', updated: 'v2' }] } }),
      });
    };
    const first = request('/spec/records/r1', { method: 'PATCH', body: JSON.stringify({ id: 'r1', name: 'a' }) });
    const second = request('/spec/records/r1', { method: 'PATCH', body: JSON.stringify({ id: 'r1', name: 'b' }) });
    const err = await rejectionOf(first);
    assertNetworkError(err, 'offline');
    const res = await second;
    assert.equal(res.status, 200);
    assert.equal(call, 2);
    assert.match(bodies[1], /"name":"b"/);
  });
});

/**
 * Wraps `signal.addEventListener` / `removeEventListener` on the instance and keeps the net
 * count of 'abort' listeners still attached — a long-lived caller signal must end every
 * settled request with the same count it started with.
 */
function trackAbortListeners(signal) {
  const live = new Set();
  const add = signal.addEventListener.bind(signal);
  const remove = signal.removeEventListener.bind(signal);
  signal.addEventListener = (type, listener, options) => {
    if (type === 'abort') live.add(listener);
    return add(type, listener, options);
  };
  signal.removeEventListener = (type, listener, options) => {
    if (type === 'abort') live.delete(listener);
    return remove(type, listener, options);
  };
  return { get count() { return live.size; } };
}

describe('combineSignals fallback without AbortSignal.any (review W4)', () => {
  const originalAny = AbortSignal.any;

  beforeEach(() => {
    AbortSignal.any = undefined;
  });

  afterEach(() => {
    AbortSignal.any = originalAny;
  });

  it('does not pile up abort listeners on a long-lived caller signal across successful requests', async () => {
    const controller = new AbortController();
    const listeners = trackAbortListeners(controller.signal);
    globalThis.fetch = async () => okResponse();
    const request = client();
    for (let i = 0; i < 5; i += 1) {
      const res = await request('/x', { timeout: 5000, signal: controller.signal });
      assert.equal(res.status, 200);
    }
    assert.equal(listeners.count, 0, `${listeners.count} abort listener(s) left on the caller signal after 5 settled requests`);
  });

  it('does not leave an abort listener behind after a request that failed offline', async () => {
    const controller = new AbortController();
    const listeners = trackAbortListeners(controller.signal);
    globalThis.fetch = async () => { throw new TypeError('Failed to fetch'); };
    const err = await rejectionOf(client()('/x', { timeout: 5000, signal: controller.signal }));
    assertNetworkError(err, 'offline');
    assert.equal(listeners.count, 0);
  });

  it('a caller abort still rejects with the caller\'s AbortError', async () => {
    const controller = new AbortController();
    globalThis.fetch = hangingFetch();
    const pending = client()('/x', { timeout: 1000, signal: controller.signal });
    setTimeout(() => controller.abort(), 5);
    const err = await rejectionWithin(pending);
    assert.equal(err, controller.signal.reason);
    assert.equal(err.name, 'AbortError');
    assert.notEqual(err.code, 'NETWORK');
  });

  it('an already-aborted caller signal rejects with the caller\'s AbortError', async () => {
    const controller = new AbortController();
    controller.abort();
    globalThis.fetch = hangingFetch();
    const err = await rejectionWithin(client()('/x', { timeout: 1000, signal: controller.signal }));
    assert.equal(err, controller.signal.reason);
  });

  it('a timeout still becomes NetworkError reason timeout', async () => {
    const controller = new AbortController();
    globalThis.fetch = hangingFetch();
    const err = await rejectionWithin(client()('/x', { timeout: 20, signal: controller.signal }));
    assertNetworkError(err, 'timeout');
  });
});

/**
 * A fetch that, when its signal aborts, does NOT reject right away: it resolves `aborted` and
 * waits for the test to call `rejectNow()`, which rejects with the signal's reason as it stood
 * at abort time — the window in which a caller abort can land after the timer already fired.
 */
function deferredAbortFetch() {
  let rejectNow;
  let markAborted;
  const aborted = new Promise((resolve) => { markAborted = resolve; });
  const fetchImpl = (url, options = {}) => new Promise((_, reject) => {
    const { signal } = options;
    const onAbort = () => {
      const reason = signal.reason;
      rejectNow = () => reject(reason);
      markAborted(reason);
    };
    if (signal.aborted) onAbort();
    else signal.addEventListener('abort', onAbort, { once: true });
  });
  return { fetchImpl, aborted, rejectNow: () => rejectNow() };
}

describe('timeout fires, then the caller aborts before the rejection is handled (review N1)', () => {
  const originalAny = AbortSignal.any;

  afterEach(() => {
    AbortSignal.any = originalAny;
  });

  for (const variant of ['AbortSignal.any', 'fallback']) {
    it(`[${variant}] rejects with the caller's abort reason, not TimeoutError nor NetworkError`, async () => {
      if (variant === 'fallback') AbortSignal.any = undefined;
      const controller = new AbortController();
      const mock = deferredAbortFetch();
      globalThis.fetch = mock.fetchImpl;
      const pending = client()('/x', { timeout: 10, signal: controller.signal });
      pending.catch(() => {});
      const timerReason = await mock.aborted;
      assert.equal(timerReason?.name, 'TimeoutError', 'precondition: the timer fired first');
      controller.abort();
      mock.rejectNow();
      const err = await rejectionWithin(pending);
      assert.equal(err, controller.signal.reason, `expected the caller's reason, got ${err?.name}: ${err?.message}`);
      assert.equal(err.name, 'AbortError');
      assert.notEqual(err.name, 'TimeoutError');
      assert.notEqual(err.code, 'NETWORK');
    });

    it(`[${variant}] keeps a custom caller abort reason as-is`, async () => {
      if (variant === 'fallback') AbortSignal.any = undefined;
      const controller = new AbortController();
      const reason = new Error('user navigated away');
      const mock = deferredAbortFetch();
      globalThis.fetch = mock.fetchImpl;
      const pending = client()('/x', { timeout: 10, signal: controller.signal });
      pending.catch(() => {});
      await mock.aborted;
      controller.abort(reason);
      mock.rejectNow();
      const err = await rejectionWithin(pending);
      assert.equal(err, reason);
    });
  }
});

/**
 * Runs `fn` with `setTimeout`/`clearTimeout` spied: every timer armed with exactly
 * DEFAULT_API_TIMEOUT_MS is recorded and, so no case waits 60 s, really scheduled after
 * `compressTo` ms instead. Any other delay (the test guards, an explicit `timeout`) is left
 * alone. `armed` counts default timers ever armed; `live` those not yet cleared or fired.
 */
async function withDefaultTimerSpy(fn, compressTo = 10) {
  const { DEFAULT_API_TIMEOUT_MS } = await loadNetworkError();
  const realSetTimeout = globalThis.setTimeout;
  const realClearTimeout = globalThis.clearTimeout;
  const spy = { armed: 0, live: new Set() };
  globalThis.setTimeout = (callback, ms, ...args) => {
    if (ms !== DEFAULT_API_TIMEOUT_MS) return realSetTimeout(callback, ms, ...args);
    spy.armed += 1;
    const id = realSetTimeout((...a) => { spy.live.delete(id); callback(...a); }, compressTo, ...args);
    spy.live.add(id);
    return id;
  };
  globalThis.clearTimeout = (id) => { spy.live.delete(id); return realClearTimeout(id); };
  try {
    return await fn(spy);
  } finally {
    globalThis.setTimeout = realSetTimeout;
    globalThis.clearTimeout = realClearTimeout;
  }
}

describe('default timeout applies only to safe methods (ETP-5424)', () => {
  const SAFE = [undefined, 'GET', 'get', 'HEAD', 'OPTIONS'];
  const UNSAFE = ['POST', 'PUT', 'PATCH', 'DELETE', 'post'];
  const label = (method) => (method === undefined ? 'no method (GET)' : method);
  const withMethod = (method, extra = {}) => (method === undefined ? { ...extra } : { method, ...extra });

  for (const method of SAFE) {
    it(`${label(method)} without \`timeout\` times out at DEFAULT_API_TIMEOUT_MS`, async () => {
      await withDefaultTimerSpy(async (spy) => {
        globalThis.fetch = hangingFetch();
        const err = await rejectionWithin(client()('/x', withMethod(method)));
        assertNetworkError(err, 'timeout');
        assert.equal(spy.armed, 1, 'expected exactly one timer armed at the default timeout');
        assert.equal(spy.live.size, 0, 'the default timer was left pending');
      });
    });
  }

  for (const method of UNSAFE) {
    it(`${method} without \`timeout\` gets no default timeout: stays pending, no timer armed`, async () => {
      await withDefaultTimerSpy(async (spy) => {
        const controller = new AbortController();
        globalThis.fetch = hangingFetch();
        const pending = client()('/x', { method, body: '{}', signal: controller.signal });
        // Well past the compressed default (10 ms): a default timer would have fired by now.
        assert.equal(await settleWithin(pending, 80), 'pending', `${method} timed out with no \`timeout\` given`);
        assert.equal(spy.armed, 0, `a DEFAULT_API_TIMEOUT_MS timer was armed for ${method}`);
        controller.abort();
        await pending.catch(() => {});
        assert.equal(spy.live.size, 0, 'a default timer was left pending');
      });
    });

    it(`${method} without \`timeout\`: the caller's abort still rejects with the caller's AbortError`, async () => {
      const controller = new AbortController();
      globalThis.fetch = hangingFetch();
      const pending = client()('/x', { method, body: '{}', signal: controller.signal });
      setTimeout(() => controller.abort(), 5);
      const err = await rejectionWithin(pending);
      assert.equal(err, controller.signal.reason);
      assert.equal(err.name, 'AbortError');
      assert.notEqual(err.code, 'NETWORK');
    });
  }

  it('POST with an explicit `timeout: 20` is still honoured → NetworkError reason timeout', async () => {
    globalThis.fetch = hangingFetch();
    const err = await rejectionWithin(client()('/x', { method: 'POST', body: '{}', timeout: 20 }));
    assertNetworkError(err, 'timeout');
  });

  it('DELETE with an explicit `timeout: 20` is still honoured → NetworkError reason timeout', async () => {
    globalThis.fetch = hangingFetch();
    const err = await rejectionWithin(client()('/x', { method: 'DELETE', timeout: 20 }));
    assertNetworkError(err, 'timeout');
  });

  it('POST with `timeout: 0` stays pending', async () => {
    await withDefaultTimerSpy(async (spy) => {
      const controller = new AbortController();
      globalThis.fetch = hangingFetch();
      const pending = client()('/x', { method: 'POST', body: '{}', timeout: 0, signal: controller.signal });
      assert.equal(await settleWithin(pending, 60), 'pending');
      assert.equal(spy.armed, 0);
      controller.abort();
      await pending.catch(() => {});
    });
  });

  it('the ambient apiFetch applies the same rule: POST without `timeout` stays pending', async () => {
    registerApiSession({ getToken: () => 'tok', baseUrl: '' });
    await withDefaultTimerSpy(async (spy) => {
      const controller = new AbortController();
      globalThis.fetch = hangingFetch();
      const pending = apiFetch('/x', { method: 'POST', body: '{}', signal: controller.signal });
      assert.equal(await settleWithin(pending, 80), 'pending');
      assert.equal(spy.armed, 0);
      controller.abort();
      await pending.catch(() => {});
    });
  });

  it('the ambient apiFetch applies the same rule: GET without `timeout` times out', async () => {
    registerApiSession({ getToken: () => 'tok', baseUrl: '' });
    await withDefaultTimerSpy(async () => {
      globalThis.fetch = hangingFetch();
      const err = await rejectionWithin(apiFetch('/x'));
      assertNetworkError(err, 'timeout');
    });
  });

  it('a queued PATCH in the serialized write queue gets no default timeout either', async () => {
    await withDefaultTimerSpy(async (spy) => {
      const request = client();
      const controller = new AbortController();
      const hang = hangingFetch();
      let call = 0;
      globalThis.fetch = (url, options) => {
        call += 1;
        if (call === 1) {
          return Promise.resolve(okResponse({
            json: async () => ({ response: { data: [{ id: 'r1', updated: 'v2' }] } }),
          }));
        }
        return hang(url, options);
      };
      const first = request('/spec/records/r1', { method: 'PATCH', body: JSON.stringify({ id: 'r1', name: 'a' }) });
      const second = request('/spec/records/r1', {
        method: 'PATCH', body: JSON.stringify({ id: 'r1', name: 'b' }), signal: controller.signal,
      });
      assert.equal((await first).status, 200);
      assert.equal(await settleWithin(second, 80), 'pending', 'the queued PATCH timed out with no `timeout` given');
      assert.equal(call, 2, 'precondition: the queued PATCH reached fetch');
      assert.equal(spy.armed, 0, 'a DEFAULT_API_TIMEOUT_MS timer was armed for a queued PATCH');
      controller.abort();
      await second.catch(() => {});
    });
  });
});

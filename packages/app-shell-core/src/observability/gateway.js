/**
 * Provider-independent telemetry egress gateway (ETP-4577, PRD WS-3 "Telemetry egress
 * governance"). The single deny-by-default boundary between application code and any
 * observability provider (Sentry/GlitchTip, AWS RUM, Mixpanel, …).
 *
 * Every outbound operation — init, reset, track, page, identify, group, groupSet,
 * captureException, breadcrumb, setContext — is sanitized here (see `./sanitize.js`) before it ever
 * reaches an adapter, positional arguments included: an event name, a route or an id is
 * as capable of carrying an email or a token as a properties object is.
 *
 * No public method ever rejects. Adapter dispatch mirrors the resilience contract the
 * functional host's `lib/observability/core.js` already had — an adapter that throws, or
 * one that is disabled, never blocks another adapter or the caller — and any other failure
 * inside a method is logged and swallowed: telemetry failure must never become a product
 * failure.
 *
 * Relocating the real provider adapters (Sentry/RUM/Mixpanel) into this package,
 * wiring their kill switches, and writing the `docs/security/telemetry-egress.md`
 * inventory are ETP-4578's scope, not this one. `provider-import-guard.test.js`
 * enforces that nothing outside this module talks to a provider SDK directly.
 */
import { sanitizeValue, sanitizeStack, normalizeRoute, resolveTrustedKeys, REDACTED } from './sanitize.js';

function safeWarn(logger, ...args) {
  try {
    if (typeof logger?.warn === 'function') logger.warn(...args);
  } catch {
    // A broken logger must not turn a swallowed telemetry failure back into a thrown one.
  }
}

/**
 * The adapter's own configuration gate (a DSN present, an explicit opt-in), read on every
 * dispatch rather than once: `enabled` may be a value or a function.
 */
function isAdapterConfiguredOn(adapter) {
  try {
    if (!adapter) return false;
    const { enabled } = adapter;
    return typeof enabled === 'function' ? Boolean(enabled.call(adapter)) : enabled !== false;
  } catch {
    return false;
  }
}

function adapterName(adapter) {
  try {
    return adapter?.name || 'unknown-adapter';
  } catch {
    return 'unknown-adapter';
  }
}

// Long enough for a real network round trip, short enough that one stuck provider cannot
// hold up the caller — telemetry is awaited on paths like app start and logout.
export const DEFAULT_ADAPTER_TIMEOUT_MS = 2000;

const TIMED_OUT = Symbol('timed-out');

/** Resolves with the call's value, or TIMED_OUT; a non-finite or non-positive limit disables it. */
function withTimeout(promise, timeoutMs) {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) return promise;
  let timer;
  const timeout = new Promise((resolve) => {
    timer = setTimeout(() => resolve(TIMED_OUT), timeoutMs);
  });
  // race() subscribes to both, so a rejection arriving after the timeout is already
  // handled; the timer is cleared either way so it never outlives the call.
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/** `{ ok }` tells a call that completed apart from one that threw or timed out. */
async function invokeAdapter(adapter, methodName, args, logger, timeoutMs) {
  try {
    const method = adapter?.[methodName];
    if (typeof method !== 'function') return { ok: true, value: undefined };
    // Called synchronously, as before: a synchronous throw lands in the catch below.
    const result = await withTimeout(Promise.resolve(method.apply(adapter, args)), timeoutMs);
    if (result === TIMED_OUT) {
      safeWarn(logger, `[observability] ${adapterName(adapter)}.${methodName} timed out after ${timeoutMs}ms`);
      return { ok: false, value: undefined };
    }
    return { ok: true, value: result };
  } catch (error) {
    safeWarn(logger, `[observability] ${adapterName(adapter)}.${methodName} failed`, error);
    return { ok: false, value: undefined };
  }
}

async function callAdapter(adapter, methodName, args, logger, timeoutMs) {
  return (await invokeAdapter(adapter, methodName, args, logger, timeoutMs)).value;
}

function safeRead(target, key) {
  try {
    return target[key];
  } catch {
    return undefined;
  }
}

function toStringOrNull(value) {
  try {
    return String(value);
  } catch {
    return null;
  }
}

function sanitizeText(value, options) {
  const raw = toStringOrNull(value);
  return raw === null ? REDACTED : sanitizeValue(raw, options);
}

/**
 * An identifier (user id, group key, group id) is either sent exactly as given or not at
 * all. Sending '[REDACTED]' instead would merge every such user into one profile in
 * Mixpanel/Sentry, so any change the scrub would make means the call is dropped.
 */
function sanitizeIdentifier(value, options) {
  const raw = toStringOrNull(value);
  if (raw === null) return null;
  return sanitizeValue(raw, options) === raw ? raw : null;
}

/** Record ids become ':id' BEFORE the scrub, so a detail view is a page, not a redaction. */
function sanitizeRoute(path, options) {
  const raw = toStringOrNull(path ?? '/');
  if (raw === null) return REDACTED;
  return sanitizeValue(normalizeRoute(raw), options);
}

function sanitizeOptionalText(value, options) {
  return typeof value === 'string' ? sanitizeValue(value, options) : undefined;
}

/** Only name, message and stack leave — never the Error itself, whose other fields were never vetted. */
function sanitizeError(error, options) {
  if (error !== null && typeof error === 'object') {
    return {
      name: sanitizeOptionalText(safeRead(error, 'name'), options),
      message: sanitizeOptionalText(safeRead(error, 'message'), options),
      stack: sanitizeStack(safeRead(error, 'stack'), options),
    };
  }
  return { name: undefined, message: sanitizeText(error, options), stack: undefined };
}

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * @param {object} options
 * @param {Array<object>} [options.adapters] Provider adapters. Each may implement any
 *   subset of init/shutdown/reset/track/page/identify/group/groupSet/captureException/
 *   breadcrumb/setContext/flush; missing methods are silently skipped. `enabled` (a value
 *   or a function, read on every dispatch) is the adapter's own configuration gate.
 * @param {boolean|Iterable<string>} [options.disabled] Initial kill-switch state: `true`
 *   kills every adapter, a list of adapter names kills those. Same as calling `disable()`
 *   before `init()`, so a killed adapter's SDK is never started.
 * @param {number} [options.adapterTimeoutMs] Upper bound on every adapter call (default
 *   `DEFAULT_ADAPTER_TIMEOUT_MS`); a stuck provider is logged and skipped. A non-finite or
 *   non-positive value disables it.
 * @param {Iterable<string>} [options.trustedKeys] Approved keys exempt from the sensitive-key-NAME
 *   rule (see `./sanitize.js`); never widens `allowedKeys`, never skips the value scrub.
 * @param {Iterable<string>} [options.allowedKeys] Forwarded to every `sanitizeValue`
 *   call — see `./sanitize.js` for the deny-by-default contract.
 * @param {{warn?: Function}} [options.logger]
 * @param {number} [options.maxDepth]
 * @param {number} [options.maxKeys]
 * @param {number} [options.maxArrayLength]
 * @param {number} [options.maxStringLength]
 * @param {number} [options.maxSerializedBytes]
 * @param {number} [options.maxNodes]
 */
export function createTelemetryGateway({
  adapters: initialAdapters = [],
  allowedKeys = [],
  trustedKeys = [],
  logger = console,
  maxDepth,
  maxKeys,
  maxArrayLength,
  maxStringLength,
  maxSerializedBytes,
  maxNodes,
  disabled = false,
  adapterTimeoutMs = DEFAULT_ADAPTER_TIMEOUT_MS,
} = {}) {
  const adapters = Array.isArray(initialAdapters) ? initialAdapters.filter(Boolean) : [];
  // Kill switch: a global flag plus a set of killed adapter names. It is the gateway's
  // own state, separate from each adapter's configuration gate, so the host can drive it
  // from runtime flags without rebuilding adapters.
  let killedAll = disabled === true;
  const killedNames = new Set(
    disabled && disabled !== true && typeof disabled !== 'string' ? Array.from(disabled) : [],
  );
  if (typeof disabled === 'string') killedNames.add(disabled);
  // Adapters started and not shut down since, and the promise of each start. A call waits
  // on the start promise, so it never reaches an adapter whose init() is still running; a
  // kill only shuts down an adapter that was actually started.
  const running = new Set();
  const starts = new Map();
  // Adapters already shut down and not started since: a kill reaches an adapter the gateway
  // never started (its SDK may have been initialized elsewhere) exactly once, not on every call.
  const shutDown = new Set();
  let initialized = false;
  const sanitizeOptions = {
    allowedKeys,
    trustedKeys: resolveTrustedKeys(trustedKeys, logger),
    maxDepth,
    maxKeys,
    maxArrayLength,
    maxStringLength,
    maxSerializedBytes,
    maxNodes,
    onInternalError: (error) =>
      safeWarn(logger, '[observability] sanitizeValue failed; the value was sent as [REDACTED]', error),
  };
  let context = {};

  const sanitize = (value) => sanitizeValue(value, sanitizeOptions);
  const envelope = () => ({ context: sanitize(context) });

  const isKilled = (adapter) => killedAll || killedNames.has(adapterName(adapter));
  const isActive = (adapter) => isAdapterConfiguredOn(adapter) && !isKilled(adapter);

  async function stop(adapter) {
    running.delete(adapter);
    starts.delete(adapter);
    shutDown.add(adapter);
    await callAdapter(adapter, 'shutdown', [envelope()], logger, adapterTimeoutMs);
  }

  /**
   * Starts an adapter once, sharing the in-flight start with every concurrent caller.
   * Resolves true when the adapter is running and still active. An init that throws or
   * times out leaves the adapter NOT running, so no call reaches a half-initialized SDK
   * and the next call retries; an adapter killed while its init was in flight is shut
   * down as soon as the init settles.
   */
  function start(adapter) {
    if (starts.has(adapter)) return starts.get(adapter);
    running.add(adapter);
    shutDown.delete(adapter);
    const starting = invokeAdapter(adapter, 'init', [envelope()], logger, adapterTimeoutMs).then(async ({ ok }) => {
      if (starts.get(adapter) !== starting) {
        // stop() ran while init was in flight; the SDK may have finished starting after
        // that shutdown, so shut it down again.
        await callAdapter(adapter, 'shutdown', [envelope()], logger, adapterTimeoutMs);
        return false;
      }
      if (!ok) {
        running.delete(adapter);
        starts.delete(adapter);
        return false;
      }
      return true;
    });
    starts.set(adapter, starting);
    return starting;
  }

  // An adapter that turned active after init() (a late opt-in, a lifted kill) is started
  // before its first call, so an SDK never receives events without having been set up.
  // Activity is checked again right before each call, after every await: a disable()
  // landing while the call was waiting must still stop it.
  async function dispatch(methodName, args) {
    const candidates = adapters.filter(isActive);
    const started = initialized ? await Promise.all(candidates.map(start)) : candidates.map(() => true);
    const ready = candidates.filter((adapter, i) => started[i] && isActive(adapter));
    await Promise.all(ready.map((adapter) => callAdapter(adapter, methodName, args, logger, adapterTimeoutMs)));
  }

  function setKilled(name, killed) {
    if (name === undefined) killedAll = killed;
    else if (killed) killedNames.add(name);
    else killedNames.delete(name);
  }

  function guarded(methodName, body) {
    return async (...args) => {
      try {
        await body(...args);
      } catch (error) {
        safeWarn(logger, `[observability] gateway.${methodName} failed`, error);
      }
    };
  }

  function drop(methodName) {
    safeWarn(logger, `[observability] ${methodName} dropped: its identifier did not survive sanitization`);
  }

  async function dispatchGroup(methodName, groupKey, groupId, payload) {
    if (!groupKey || !groupId) return;
    const key = sanitizeIdentifier(groupKey, sanitizeOptions);
    const id = sanitizeIdentifier(groupId, sanitizeOptions);
    if (key === null || id === null) {
      drop(methodName);
      return;
    }
    await dispatch(methodName, [key, id, sanitize(payload), envelope()]);
  }

  function mergeContext(nextContext) {
    const safe = sanitize(nextContext);
    if (isRecord(safe)) context = { ...context, ...safe };
  }

  return {
    /** Starts every active adapter, handing it the sanitized initial context. */
    init: guarded('init', async (initialContext = {}) => {
      mergeContext(initialContext);
      initialized = true;
      await Promise.all(adapters.filter(isActive).map(start));
    }),

    /**
     * Kill switch. Without a name it kills every adapter; with one, that adapter only. A
     * running adapter is shut down once (its SDK stops auto-instrumenting); one that never
     * started is simply never started. Every later call skips a killed adapter.
     */
    disable: guarded('disable', async (name) => {
      setKilled(name, true);
      // Every killed adapter is stopped: a running one, and — once init() has run — one that
      // is not running (its init failed or timed out, so its SDK may be half started). Before
      // init() nothing is called: a kill followed by init() must mean zero calls, and an
      // adapter the gateway never initialized cannot be told apart from one it will not.
      const toStop = new Set([...running].filter((a) => !isActive(a)));
      if (initialized) for (const adapter of adapters) if (isKilled(adapter) && !shutDown.has(adapter)) toStop.add(adapter);
      await Promise.all([...toStop].map(stop));
    }),

    /**
     * Lifts the global switch (no name) or one adapter's. If the gateway is already
     * initialized, every adapter that becomes active is started again. Lifting the global
     * switch does not revive an adapter killed by name.
     */
    enable: guarded('enable', async (name) => {
      setKilled(name, false);
      if (!initialized) return;
      await Promise.all(adapters.filter(isActive).map(start));
    }),

    isEnabled(name) {
      return adapters.some((adapter) => adapterName(adapter) === name && isActive(adapter));
    },

    /** Clears provider-side identity (logout). The gateway's own context is app-level and kept. */
    reset: guarded('reset', async () => {
      await dispatch('reset', [envelope()]);
    }),

    track: guarded('track', async (eventName, properties = {}) => {
      if (!eventName) return;
      await dispatch('track', [sanitizeText(eventName, sanitizeOptions), sanitize(properties), envelope()]);
    }),

    page: guarded('page', async (path, properties = {}) => {
      await dispatch('page', [sanitizeRoute(path, sanitizeOptions), sanitize(properties), envelope()]);
    }),

    identify: guarded('identify', async (userId, traits = {}) => {
      if (!userId) return;
      const id = sanitizeIdentifier(userId, sanitizeOptions);
      if (id === null) {
        drop('identify');
        return;
      }
      await dispatch('identify', [id, sanitize(traits), envelope()]);
    }),

    group: guarded('group', (groupKey, groupId, traits = {}) => dispatchGroup('group', groupKey, groupId, traits)),

    groupSet: guarded('groupSet', (groupKey, groupId, properties = {}) =>
      dispatchGroup('groupSet', groupKey, groupId, properties)),

    captureException: guarded('captureException', async (error, details = {}) => {
      if (!error) return;
      await dispatch('captureException', [sanitizeError(error, sanitizeOptions), sanitize(details), envelope()]);
    }),

    breadcrumb: guarded('breadcrumb', async (crumb = {}) => {
      await dispatch('breadcrumb', [sanitize(crumb)]);
    }),

    setContext: guarded('setContext', async (nextContext = {}) => {
      mergeContext(nextContext);
      await dispatch('setContext', [sanitize(context)]);
    }),

    flush: guarded('flush', async () => {
      await dispatch('flush', []);
    }),

    getContext() {
      try {
        return sanitize(context);
      } catch {
        return {};
      }
    },
  };
}

import { apiFetch } from '../../auth/api.js';
import { buildUsageCatalog, USAGE_DESTINATIONS } from './usageEvents.js';

/**
 * Browser client for `POST /sws/neo/usage` (ETP-5462, plan §6).
 *
 * Buffers usage events in memory and sends them in batches, so instrumenting a click costs an
 * array push and never a request. Flushes when the oldest buffered event is `flushIntervalMs`
 * old, when `flushAtSize` events are buffered, and when the page is hidden or unloaded
 * (`visibilitychange → hidden`, `pagehide`).
 *
 * Usage is product insight, never part of what the user is doing, so every failure is swallowed:
 * a refused, offline or 401 flush drops that batch and nothing else happens — no error surfaced,
 * no log-out (`on401: 'ignore'`), no retry. Memory is bounded: past `maxBuffer` the oldest events
 * are dropped.
 *
 * Sent through `apiFetch` (request policy — never a bare `fetch`) with `keepalive`, so the
 * `pagehide` flush survives the unload. `navigator.sendBeacon` cannot carry the credential
 * headers, which is why it is not used. Browsers cap in-flight keepalive bodies at 64 KB, so a
 * chunk above {@link KEEPALIVE_MAX_BYTES} goes without it rather than being rejected outright.
 *
 * Every collaborator is injectable (`request`, `now`, timers, lifecycle targets, catalog) so the
 * client is testable under plain `node --test` without a DOM or a network.
 */

export const USAGE_ENDPOINT = '/sws/neo/usage';
export const KEEPALIVE_MAX_BYTES = 60_000;

const DEFAULTS = Object.freeze({
  flushIntervalMs: 10_000,
  flushAtSize: 20,
  chunkSize: 50,
  maxBuffer: 500,
});

const STRING_FIELDS = ['target', 'action', 'outcome', 'errorCode', 'sessionKey'];

function isNonEmptyString(value) {
  return typeof value === 'string' && value.length > 0;
}

function isPrimitive(value) {
  return typeof value === 'string'
    || typeof value === 'boolean'
    || (typeof value === 'number' && Number.isFinite(value));
}

/** Keeps only the flat string/number/boolean entries the server accepts. */
export function sanitizeUsageProperties(properties) {
  if (!properties || typeof properties !== 'object' || Array.isArray(properties)) return undefined;
  const flat = {};
  for (const [key, value] of Object.entries(properties)) {
    if (isPrimitive(value)) flat[key] = value;
  }
  return Object.keys(flat).length > 0 ? flat : undefined;
}

function sanitizeDuration(value) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return undefined;
  return Math.round(value);
}

/** Build-time app version, when the host bundle defines one. Absent everywhere else. */
export function resolveAppVersion(env = import.meta.env, buildMetadata = globalThis) {
  const candidates = [env?.VITE_APP_VERSION, buildMetadata?.__APP_VERSION__];
  return candidates.find((candidate) => isNonEmptyString(candidate));
}

function isDevBuild() {
  return Boolean(import.meta.env?.DEV);
}

function byteLength(text) {
  if (typeof TextEncoder === 'function') return new TextEncoder().encode(text).length;
  return text.length * 3;
}

/**
 * @param {object} [options]
 * @param {Map<string, {name: string, destinations: readonly string[]}>} [options.catalog]
 * @param {(path: string, init: object) => Promise<Response>} [options.request] `apiFetch`-shaped
 * @param {(eventType: string, properties: object) => void} [options.mixpanel] Mixpanel sink
 * @param {() => number} [options.now] epoch millis
 * @param {typeof setTimeout} [options.setTimer]
 * @param {typeof clearTimeout} [options.clearTimer]
 * @param {Document|null} [options.doc] `visibilitychange` source; null disables it
 * @param {Window|null} [options.win] `pagehide` source; null disables it
 * @param {string} [options.appVersion]
 * @param {(message: string) => void} [options.warn] dev-only diagnostics
 */
export function createUsageClient(options = {}) {
  const config = { ...DEFAULTS, ...options };
  const catalog = options.catalog ?? buildUsageCatalog();
  const now = options.now ?? (() => Date.now());
  const setTimer = options.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
  const clearTimer = options.clearTimer ?? ((id) => clearTimeout(id));
  const doc = options.doc !== undefined ? options.doc : globalThis.document ?? null;
  const win = options.win !== undefined ? options.win : globalThis.window ?? null;
  const appVersion = options.appVersion !== undefined ? options.appVersion : resolveAppVersion();
  const warn = options.warn ?? (isDevBuild() ? (message) => console.warn(message) : () => {});

  let request = options.request ?? apiFetch;
  let mixpanel = options.mixpanel ?? null;
  let buffer = [];
  let timer = null;
  let listening = false;
  let droppedEvents = 0;
  const warnedTypes = new Set();

  const onVisibilityChange = () => {
    if (doc?.visibilityState === 'hidden') flush();
  };
  const onPageHide = () => flush();

  function listen() {
    if (listening) return;
    listening = true;
    doc?.addEventListener?.('visibilitychange', onVisibilityChange);
    win?.addEventListener?.('pagehide', onPageHide);
  }

  function cancelTimer() {
    if (timer !== null) clearTimer(timer);
    timer = null;
  }

  function scheduleFlush() {
    if (timer !== null) return;
    timer = setTimer(() => {
      timer = null;
      flush();
    }, config.flushIntervalMs);
    timer?.unref?.();
  }

  function send(chunk, sender) {
    const body = JSON.stringify({ events: chunk });
    const init = {
      method: 'POST',
      body,
      on401: 'ignore',
      keepalive: byteLength(body) <= KEEPALIVE_MAX_BYTES,
    };
    try {
      return Promise.resolve(sender(USAGE_ENDPOINT, init)).then(() => undefined, () => undefined);
    } catch {
      return Promise.resolve();
    }
  }

  /**
   * Sends everything buffered, in chunks of `chunkSize`. Never rejects; the promise only exists
   * so a caller (or a test) can wait for the sends to settle.
   */
  function flush() {
    cancelTimer();
    if (buffer.length === 0) return Promise.resolve();
    const pending = buffer;
    buffer = [];
    const sender = request;
    const sends = [];
    for (let i = 0; i < pending.length; i += config.chunkSize) {
      sends.push(send(pending.slice(i, i + config.chunkSize), sender));
    }
    return Promise.all(sends).then(() => undefined);
  }

  /**
   * Swaps the request function (the hook hands in its session-bound `apiFetch`). Events buffered
   * under the previous one are flushed with it first, so an event is never re-attributed to a
   * session that did not produce it — after a log-out the old function refuses the request and
   * the batch is dropped, which is the intended outcome.
   */
  function setRequest(next) {
    if (typeof next !== 'function' || next === request) return;
    if (buffer.length > 0) flush();
    request = next;
  }

  function setMixpanel(next) {
    mixpanel = typeof next === 'function' ? next : null;
  }

  function enqueue(event) {
    buffer.push(event);
    if (buffer.length > config.maxBuffer) {
      const overflow = buffer.length - config.maxBuffer;
      buffer.splice(0, overflow);
      droppedEvents += overflow;
    }
    if (buffer.length >= config.flushAtSize) flush();
    else scheduleFlush();
  }

  function buildTableEvent(eventType, fields, properties) {
    const event = { eventType, source: 'ui', occurredAt: new Date(now()).toISOString() };
    for (const key of STRING_FIELDS) {
      if (isNonEmptyString(fields[key])) event[key] = fields[key];
    }
    const durationMs = sanitizeDuration(fields.durationMs);
    if (durationMs !== undefined) event.durationMs = durationMs;
    if (isNonEmptyString(appVersion)) event.appVersion = appVersion;
    if (properties) event.properties = properties;
    return event;
  }

  function buildMixpanelProperties(fields, properties) {
    const out = {};
    for (const key of STRING_FIELDS) {
      if (key !== 'sessionKey' && isNonEmptyString(fields[key])) out[key] = fields[key];
    }
    const durationMs = sanitizeDuration(fields.durationMs);
    if (durationMs !== undefined) out.durationMs = durationMs;
    return { ...out, ...properties };
  }

  /**
   * Records one usage event and fans it out to the destinations its catalog entry declares.
   * Unknown types are ignored (a dev build warns once per type). Never throws.
   *
   * @param {string} eventType a catalog name
   * @param {{target?: string, action?: string, outcome?: string, errorCode?: string,
   *   durationMs?: number, sessionKey?: string, properties?: object}} [fields]
   */
  function track(eventType, fields = {}) {
    try {
      const entry = catalog.get(eventType);
      if (!entry) {
        if (!warnedTypes.has(eventType)) {
          warnedTypes.add(eventType);
          warn(`[usage] "${eventType}" is not in the usage catalog; ignored`);
        }
        return;
      }
      const safeFields = fields && typeof fields === 'object' ? fields : {};
      const properties = sanitizeUsageProperties(safeFields.properties);

      if (entry.destinations.includes(USAGE_DESTINATIONS.MIXPANEL) && mixpanel) {
        try {
          mixpanel(eventType, buildMixpanelProperties(safeFields, properties));
        } catch {
          // The host's telemetry failing must not stop the table side.
        }
      }
      if (entry.destinations.includes(USAGE_DESTINATIONS.TABLE)) {
        listen();
        enqueue(buildTableEvent(eventType, safeFields, properties));
      }
    } catch {
      // Usage must never break the caller.
    }
  }

  function dispose() {
    cancelTimer();
    if (listening) {
      doc?.removeEventListener?.('visibilitychange', onVisibilityChange);
      win?.removeEventListener?.('pagehide', onPageHide);
      listening = false;
    }
    buffer = [];
  }

  return {
    track,
    flush,
    setRequest,
    setMixpanel,
    dispose,
    pendingCount: () => buffer.length,
    droppedCount: () => droppedEvents,
  };
}

let sharedClient = null;

/** The app-wide client every `useUsage()` shares, created on first use. */
export function getUsageClient() {
  if (!sharedClient) sharedClient = createUsageClient();
  return sharedClient;
}

/** Test seam: drops the shared client so suites do not leak a buffer into the next. */
export function resetUsageClientForTests() {
  sharedClient?.dispose();
  sharedClient = null;
}

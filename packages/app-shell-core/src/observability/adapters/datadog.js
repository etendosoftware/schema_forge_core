/**
 * Datadog Browser RUM adapter for the telemetry gateway (ETP-4578, PRD WS-3).
 *
 * The SDK is INJECTED through `loadSdk` (the host lazy-imports `@datadog/browser-rum` and,
 * optionally, `@datadog/browser-rum-react`), so this package never imports a provider SDK
 * and the SDK is only downloaded when the provider is enabled and not killed.
 *
 * What the gateway hands over (actions, views, identity, errors, context, flag evaluations)
 * is already sanitized. Most of what RUM sends is not: views, resources, long tasks, user
 * actions and unhandled errors are collected by the SDK itself. That egress is closed in
 * `beforeSend`, the SDK's only pre-send hook. Unlike Sentry's hooks it cannot rebuild an
 * event: the SDK applies only the changes made to a fixed list of fields per event type
 * (`MODIFIABLE_FIELD_PATHS_BY_EVENT` in rum-core 7.15) and silently reverts the rest. So
 * every modifiable field that can carry user data is rewritten through the gateway's
 * sanitizers, and what cannot be modified is kept out at the source instead:
 *
 *  - `usr` and `account` are NOT modifiable: the adapter only ever sets their `id`
 *    (`identify`, `group`), never a name or an email;
 *  - request/response headers are not collected (`trackResourceHeaders` stays off);
 *  - user-action names are masked by the SDK (`enablePrivacyForActionName`, on by default
 *    in v7, and `defaultPrivacyLevel: 'mask'`), and scrubbed again here.
 *
 * View events cannot be dropped from `beforeSend` (the SDK ignores `false` for them), so the
 * kill switch does not rely on it: `shutdown()` withdraws tracking consent, which stops
 * collection and sending, and `beforeSend` drops whatever else is still in flight.
 *
 * Remote configuration (`remoteConfigurationId`) is off unless the host passes an id: from
 * the Datadog UI it can change the privacy level, the tracing URLs and the user/global
 * context, outside code review. `beforeSend` still applies to everything it produces.
 */
import { normalizeRoute, resolveTrustedKeys, sanitizeStack, sanitizeValue } from '../sanitize.js';
import { safeWarn } from './shared.js';

export const DEFAULT_DATADOG_SERVICE = 'etendo-go-web';
export const DEFAULT_DATADOG_SESSION_SAMPLE_RATE = 100;
export const DEFAULT_DATADOG_SESSION_REPLAY_SAMPLE_RATE = 20;
export const DEFAULT_DATADOG_TRACE_SAMPLE_RATE = 20;
// Datadog adds the view and error contexts on its own; the SDK accepts only these four more.
export const DATADOG_FEATURE_FLAG_EVENTS = ['vital', 'action', 'long_task', 'resource'];
// Flag evaluations made before init() (the flag provider usually answers first) are replayed
// once the SDK is up; bounded so a misbehaving caller cannot grow it without limit.
const MAX_PENDING_FLAG_EVALUATIONS = 100;

/** A 0–100 sample rate; anything unparseable falls back to the default. */
export function boundedSampleRate(value, fallback) {
  if (value == null || value === '') return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(100, number)) : fallback;
}

/**
 * Trace headers go only to exact, configured first-party API origins, and only under their
 * `/sws/neo` path: no suffix, regex or prefix-of-origin matching. `bases` is an array of URLs
 * or its JSON text (the form a Vite variable has); anything invalid disables propagation.
 */
export function resolveTracingUrls(bases, logger = console) {
  if (!bases || (Array.isArray(bases) && bases.length === 0)) return [];
  try {
    const list = typeof bases === 'string' ? JSON.parse(bases) : bases;
    if (!Array.isArray(list)) throw new Error('Expected an array of API bases');
    return list.map((value) => {
      const base = new URL(value);
      if (!['https:', 'http:'].includes(base.protocol) || base.username || base.password ||
          base.search || base.hash || base.hostname.includes('*')) {
        throw new Error('Invalid trusted API base');
      }
      const path = `${base.pathname.replace(/\/$/, '')}/sws/neo`;
      return {
        match: (candidate) => {
          try {
            const url = new URL(candidate);
            return !url.username && !url.password && url.origin === base.origin &&
              (url.pathname === path || url.pathname.startsWith(`${path}/`));
          } catch {
            return false;
          }
        },
        propagatorTypes: ['tracecontext', 'datadog'],
      };
    });
  } catch {
    safeWarn(logger, '[observability] datadog: invalid trace API bases; trace propagation disabled');
    return [];
  }
}

/** Datadog flag keys accept identifier characters only (`a-z`, `0-9`, `_`), up to 100. */
export function toDatadogFlagKey(flagKey) {
  const replaced = String(flagKey ?? '').replace(/[^A-Za-z0-9_]/g, '_');
  // Trimmed with indexes, not `/^_+|_+$/`: an anchored-at-end quantifier is a backtracking hotspot.
  let start = 0;
  let end = replaced.length;
  while (start < end && replaced[start] === '_') start += 1;
  while (end > start && replaced[end - 1] === '_') end -= 1;
  return replaced.slice(start, end).slice(0, 100) || 'flag';
}

function resolvePolicy(policy = {}) {
  return {
    ...(policy.limits ?? {}),
    allowedKeys: Array.from(policy.allowedKeys ?? []),
    trustedKeys: Array.from(policy.trustedKeys ?? []),
  };
}

function scrubString(value, options) {
  if (typeof value !== 'string') return value;
  const clean = sanitizeValue(value, options);
  return typeof clean === 'string' ? clean : '';
}

function scrubUrl(value, options) {
  return typeof value === 'string' ? scrubString(normalizeRoute(value), options) : value;
}

function scrubStack(value, options) {
  return typeof value === 'string' ? (sanitizeStack(value, options) ?? '') : value;
}

/**
 * Rewrites, in place, every field of a RUM event that the SDK lets `beforeSend` modify and
 * that can carry user data. Fields outside that list would be reverted by the SDK anyway.
 */
export function sanitizeDatadogEvent(event, policy = {}) {
  const options = resolvePolicy(policy);
  if (event.view && typeof event.view === 'object') {
    event.view.url = scrubUrl(event.view.url, options);
    event.view.referrer = scrubUrl(event.view.referrer, options);
    event.view.name = scrubUrl(event.view.name, options);
    const lcp = event.view.performance?.lcp;
    if (lcp && typeof lcp === 'object') lcp.resource_url = scrubUrl(lcp.resource_url, options);
  }
  if (event.resource && typeof event.resource === 'object') {
    event.resource.url = scrubUrl(event.resource.url, options);
    // Never collected (`trackResourceHeaders` is off); emptied in case a future default changes.
    if (event.resource.request && typeof event.resource.request === 'object') event.resource.request.headers = {};
    if (event.resource.response && typeof event.resource.response === 'object') event.resource.response.headers = {};
  }
  if (event.error && typeof event.error === 'object') {
    event.error.message = scrubString(event.error.message, options);
    event.error.stack = scrubStack(event.error.stack, options);
    event.error.handling_stack = scrubStack(event.error.handling_stack, options);
    if (event.error.resource && typeof event.error.resource === 'object') {
      event.error.resource.url = scrubUrl(event.error.resource.url, options);
    }
  }
  if (event.action?.target && typeof event.action.target === 'object') {
    event.action.target.name = scrubString(event.action.target.name, options);
  }
  if (Array.isArray(event.long_task?.scripts)) {
    for (const script of event.long_task.scripts) {
      if (!script || typeof script !== 'object') continue;
      script.source_url = scrubUrl(script.source_url, options);
      script.invoker = scrubString(script.invoker, options);
    }
  }
  // The gateway already sanitized what it set; this also covers context the SDK or a remote
  // configuration added. A non-object result becomes {}, which the SDK accepts.
  const context = sanitizeValue(event.context ?? {}, options);
  event.context = context && typeof context === 'object' && !Array.isArray(context) ? context : {};
  return event;
}

/**
 * @param {object} options
 * @param {() => Promise<{datadogRum: object, reactPlugin?: Function}>} options.loadSdk
 *   Lazy loader for the injected SDK modules.
 * @param {boolean|string} [options.enabled] Explicit opt-in; off by default.
 * @param {string} [options.applicationId]
 * @param {string} [options.clientToken] Public by design (it only allows sending).
 * @param {string} [options.site] e.g. `datadoghq.eu`.
 * @param {string} [options.env] The Datadog `env` tag (production, staging, …).
 * @param {string} [options.service]
 * @param {string} [options.version]
 * @param {number|string} [options.sessionSampleRate] 0–100.
 * @param {number|string} [options.sessionReplaySampleRate] 0–100.
 * @param {Array<string>|string} [options.traceApiBases] See `resolveTracingUrls()`.
 * @param {number|string} [options.traceSampleRate] 0–100.
 * @param {string} [options.remoteConfigurationId] Off unless set (see the header comment).
 * @param {Iterable<string>} [options.allowedKeys] Context keys that may leave (deny-by-default).
 * @param {Iterable<string>} [options.trustedKeys]
 * @param {object} [options.limits] Forwarded to `sanitizeValue()`.
 * @param {() => string} [options.currentPath] Where the first view starts.
 * @param {{warn?: Function}} [options.logger]
 */
export function createDatadogAdapter({
  loadSdk,
  enabled = false,
  applicationId,
  clientToken,
  site,
  env,
  service = DEFAULT_DATADOG_SERVICE,
  version,
  sessionSampleRate,
  sessionReplaySampleRate,
  traceApiBases,
  traceSampleRate,
  remoteConfigurationId,
  allowedKeys,
  trustedKeys,
  limits,
  currentPath = () => globalThis.location?.pathname,
  logger = console,
} = {}) {
  const optedIn = enabled === true || enabled === 'true';
  const configured = Boolean(applicationId && clientToken && site && env && typeof loadSdk === 'function');
  if (optedIn && !configured) {
    safeWarn(logger, '[observability] Datadog is enabled but needs an application id, client token, site and environment');
  }
  const policy = { allowedKeys, trustedKeys: resolveTrustedKeys(trustedKeys, logger), limits };
  const options = resolvePolicy(policy);
  // Set synchronously by the kill switch: beforeSend drops whatever the SDK still has in flight.
  let stopped = false;
  let rum;
  let starting;
  let currentRoute;
  let lastAccountId;
  const pendingFlags = new Map();

  function beforeSend(event) {
    if (stopped) return false;
    try {
      sanitizeDatadogEvent(event, policy);
      return true;
    } catch (error) {
      // A view cannot be dropped; every other event type is, rather than sent unsanitized.
      safeWarn(logger, '[observability] datadog dropped an event it could not sanitize', error);
      return false;
    }
  }

  function routeOf(path) {
    return scrubUrl(normalizeRoute(String(path || '/')), options) || '/';
  }

  async function start() {
    const { datadogRum, reactPlugin } = await loadSdk();
    datadogRum.init({
      applicationId,
      clientToken,
      site,
      env,
      service,
      version,
      sessionSampleRate: boundedSampleRate(sessionSampleRate, DEFAULT_DATADOG_SESSION_SAMPLE_RATE),
      sessionReplaySampleRate: boundedSampleRate(sessionReplaySampleRate, DEFAULT_DATADOG_SESSION_REPLAY_SAMPLE_RATE),
      ...(remoteConfigurationId ? { remoteConfigurationId } : {}),
      trackingConsent: 'granted',
      trackFeatureFlagsForEvents: DATADOG_FEATURE_FLAG_EVENTS,
      allowedTracingUrls: resolveTracingUrls(traceApiBases, logger),
      traceSampleRate: boundedSampleRate(traceSampleRate, DEFAULT_DATADOG_TRACE_SAMPLE_RATE),
      traceContextInjection: 'sampled',
      defaultPrivacyLevel: 'mask',
      enablePrivacyForActionName: true,
      trackUserInteractions: true,
      trackViewsManually: true,
      trackResources: true,
      trackLongTasks: true,
      ...(typeof reactPlugin === 'function' ? { plugins: [reactPlugin({ router: false })] } : {}),
      beforeSend,
    });
    currentRoute = routeOf(currentPath());
    datadogRum.startView({ name: currentRoute });
    rum = datadogRum;
    for (const [key, value] of pendingFlags) rum.addFeatureFlagEvaluation(key, value);
    pendingFlags.clear();
  }

  const call = (method, ...args) => (typeof rum?.[method] === 'function' ? rum[method](...args) : undefined);

  return {
    name: 'datadog',
    enabled: optedIn && configured,

    async init() {
      stopped = false;
      if (rum) {
        // Revived after a kill: the SDK is still loaded, only consent was withdrawn.
        call('setTrackingConsent', 'granted');
        return;
      }
      // A retried start (the gateway retries a failed or timed-out init) reuses the same load.
      starting ??= start().catch((error) => {
        starting = undefined;
        throw error;
      });
      await starting;
    },

    /** Hot kill: withdraws consent (stops collection and sending) and drops what is in flight. */
    shutdown() {
      stopped = true;
      pendingFlags.clear();
      call('setTrackingConsent', 'not-granted');
    },

    track(eventName, properties) {
      call('addAction', eventName, properties);
    },

    page(route) {
      if (!rum || route === currentRoute) return;
      currentRoute = route;
      rum.startView({ name: route });
    },

    identify(userId) {
      call('setUser', { id: userId });
    },

    group(groupKey, groupId) {
      if (groupKey !== 'account_id' || !rum) return;
      const next = String(groupId);
      rum.setAccount({ id: next });
      // A tenant switch starts a new view, so the previous tenant's flag context is not
      // attached to later events. The first assignment stays in the current view.
      if (lastAccountId && lastAccountId !== next) rum.startView({ name: currentRoute });
      lastAccountId = next;
    },

    captureException(summary, details) {
      if (typeof rum?.addError !== 'function') return;
      const error = new Error(typeof summary?.message === 'string' ? summary.message : '');
      if (typeof summary?.name === 'string') error.name = summary.name;
      error.stack = typeof summary?.stack === 'string' ? summary.stack : '';
      rum.addError(error, details);
    },

    setContext(context) {
      call('setGlobalContext', context);
    },

    reset() {
      call('stopSession');
      call('clearUser');
      call('clearAccount');
      call('setGlobalContext', {});
      lastAccountId = undefined;
    },

    addFeatureFlagEvaluation(flagKey, value) {
      if (stopped) return;
      const key = toDatadogFlagKey(flagKey);
      if (rum) {
        rum.addFeatureFlagEvaluation(key, value);
      } else if (pendingFlags.has(key) || pendingFlags.size < MAX_PENDING_FLAG_EVALUATIONS) {
        pendingFlags.set(key, value);
      }
    },

    // The browser SDK flushes on its own lifecycle (page hide, batch size); it has no flush API.
    flush() {},
  };
}

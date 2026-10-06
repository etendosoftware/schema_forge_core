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
 * sanitizers (a referrer from another site is dropped), and what cannot be modified is kept
 * out at the source instead:
 *
 *  - `usr` and `account` are NOT modifiable: the adapter only ever sets their `id`
 *    (`identify`, `group`), never a name or an email;
 *  - request/response headers are not collected (`trackResourceHeaders` stays off);
 *  - user-action names are masked by the SDK (`enablePrivacyForActionName`, on by default
 *    in v7, and `defaultPrivacyLevel: 'mask'`), and scrubbed again here;
 *  - `error.causes` is not modifiable either: an error whose causes the sanitizers would
 *    change is dropped;
 *  - the SDK's own telemetry (its internal errors, sent to Datadog without `beforeSend`) is
 *    off (`telemetrySampleRate: 0`).
 *
 * View events cannot be dropped from `beforeSend` (the SDK ignores `false` for them), so every
 * event is sanitized first, even after a kill. `shutdown()` withdraws tracking consent, which
 * ends the session: the SDK still sends the end of the current view (sanitized) and stops
 * collecting; `beforeSend` drops every other event still in flight.
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
 * A referrer from another site is dropped, as the Mixpanel adapter does (it names where the user
 * came from: a mail provider, a customer's intranet); one from this app is kept, scrubbed.
 */
function scrubReferrer(referrer, pageUrl, options) {
  if (typeof referrer !== 'string' || referrer === '') return referrer;
  try {
    // Relative URLs (same origin by definition) resolve against a placeholder origin.
    const page = new URL(String(pageUrl), 'https://relative.invalid');
    if (new URL(referrer, page).origin !== page.origin) return '';
  } catch {
    return '';
  }
  return scrubUrl(referrer, options);
}

/** True when a cause's message or stack would change under the sanitizers (`causes` is read-only). */
function hasUnsafeCauses(event, options) {
  const causes = event.error?.causes;
  if (!Array.isArray(causes)) return false;
  return causes.some((cause) => !cause || typeof cause !== 'object' ||
    scrubString(cause.message, options) !== cause.message ||
    scrubStack(cause.stack, options) !== cause.stack);
}

/**
 * Rewrites, in place, every field of a RUM event that the SDK lets `beforeSend` modify and
 * that can carry user data. Fields outside that list would be reverted by the SDK anyway.
 */
export function sanitizeDatadogEvent(event, policy = {}) {
  const options = resolvePolicy(policy);
  if (event.view && typeof event.view === 'object') {
    event.view.referrer = scrubReferrer(event.view.referrer, event.view.url, options);
    event.view.url = scrubUrl(event.view.url, options);
    event.view.name = scrubUrl(event.view.name, options);
    const lcp = event.view.performance?.lcp;
    if (lcp && typeof lcp === 'object') lcp.resource_url = scrubUrl(lcp.resource_url, options);
  }
  if (event.resource && typeof event.resource === 'object') {
    event.resource.url = scrubUrl(event.resource.url, options);
    // Never collected (`trackResourceHeaders` is off); emptied in case a future default changes.
    if (event.resource.request && typeof event.resource.request === 'object') event.resource.request.headers = {};
    if (event.resource.response && typeof event.resource.response === 'object') event.resource.response.headers = {};
    if (event.resource.graphql && typeof event.resource.graphql === 'object') {
      event.resource.graphql.variables = scrubString(event.resource.graphql.variables, options);
    }
    if (event.resource.websocket && typeof event.resource.websocket === 'object') {
      event.resource.websocket.close_reason = scrubString(event.resource.websocket.close_reason, options);
      // Some auth libraries pass a token as a WebSocket subprotocol.
      event.resource.websocket.protocol = scrubString(event.resource.websocket.protocol, options);
    }
  }
  if (event.error && typeof event.error === 'object') {
    event.error.message = scrubString(event.error.message, options);
    event.error.stack = scrubStack(event.error.stack, options);
    event.error.handling_stack = scrubStack(event.error.handling_stack, options);
    event.error.fingerprint = scrubString(event.error.fingerprint, options);
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
  // The name of the last view handed to the SDK.
  let viewName;
  let lastAccountId;
  const pendingFlags = new Map();

  // Sanitizes before deciding: a view is sent even when this returns false (the SDK cannot
  // drop views), so the one that ends with a kill must be clean too.
  function beforeSend(event) {
    try {
      sanitizeDatadogEvent(event, policy);
      if (event.type === 'error' && hasUnsafeCauses(event, options)) return false;
      return !stopped;
    } catch (error) {
      blankView(event);
      safeWarn(logger, '[observability] datadog dropped an event it could not sanitize', error);
      return false;
    }
  }

  // Last resort for a view the sanitizers failed on: it is sent anyway, so it goes out empty.
  function blankView(event) {
    try {
      event.context = {};
      if (event?.view && typeof event.view === 'object') {
        event.view.url = '';
        event.view.referrer = '';
        event.view.name = '';
        const lcp = event.view.performance?.lcp;
        if (lcp && typeof lcp === 'object') lcp.resource_url = '';
      }
    } catch {
      // Nothing more can be done from here; the event type decides whether the SDK sends it.
    }
  }

  function routeOf(path) {
    return scrubUrl(normalizeRoute(String(path || '/')), options) || '/';
  }

  async function start() {
    const { datadogRum, reactPlugin } = await loadSdk();
    // A kill can land while the SDK loads (the gateway's init timeout gives up waiting first):
    // the SDK then starts without consent, and a later init() grants it.
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
      trackingConsent: stopped ? 'not-granted' : 'granted',
      telemetrySampleRate: 0,
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
    rum = datadogRum;
    showView(routeOf(currentPath()));
    for (const [key, value] of pendingFlags) rum.addFeatureFlagEvaluation(key, value);
    pendingFlags.clear();
  }

  // Without consent the SDK buffers startView() calls and replays them, with their old start
  // times, once consent is granted; so a killed adapter only records where the user is.
  function showView(route, { force = false } = {}) {
    currentRoute = route;
    if (stopped || !rum || (route === viewName && !force)) return;
    viewName = route;
    rum.startView({ name: route });
  }

  // Nothing reaches the SDK while killed: without consent it would buffer the call and replay it,
  // with its old timestamp, on the next grant. (The gateway does not dispatch to a killed adapter
  // either; this holds for a direct call too.)
  const call = (method, ...args) => (!stopped && typeof rum?.[method] === 'function' ? rum[method](...args) : undefined);

  const active = optedIn && configured;

  return {
    name: 'datadog',
    enabled: active,

    async init() {
      // The gateway never starts a disabled adapter; a direct call must not load the SDK either.
      if (!active) return;
      stopped = false;
      if (rum) {
        // Revived after a kill: the SDK is still loaded, only consent was withdrawn. Granting it
        // starts a new session; its first view is the current route, wherever the user went.
        rum.setTrackingConsent?.('granted');
        showView(routeOf(currentPath()));
        return;
      }
      // A retried start (the gateway retries a failed or timed-out init) reuses the same load.
      starting ??= start().catch((error) => {
        starting = undefined;
        throw error;
      });
      await starting;
    },

    /** Hot kill: withdraws consent (ends the session and collection) and drops what is in flight. */
    shutdown() {
      stopped = true;
      pendingFlags.clear();
      rum?.setTrackingConsent?.('not-granted');
    },

    track(eventName, properties) {
      call('addAction', eventName, properties);
    },

    page(route) {
      showView(route);
    },

    identify(userId) {
      call('setUser', { id: userId });
    },

    group(groupKey, groupId) {
      if (groupKey !== 'account_id' || !rum || stopped) return;
      const next = String(groupId);
      rum.setAccount({ id: next });
      // A tenant switch starts a new view, so the previous tenant's flag context is not
      // attached to later events. The first assignment stays in the current view.
      if (lastAccountId && lastAccountId !== next) showView(currentRoute, { force: true });
      lastAccountId = next;
    },

    captureException(summary, details) {
      if (stopped || typeof rum?.addError !== 'function') return;
      const error = new Error(typeof summary?.message === 'string' ? summary.message : '');
      if (typeof summary?.name === 'string') error.name = summary.name;
      error.stack = typeof summary?.stack === 'string' ? summary.stack : '';
      rum.addError(error, details);
    },

    setContext(context) {
      call('setGlobalContext', context);
    },

    // The last tenant is kept on purpose: whoever signs in next under another tenant gets a new
    // view, so no flag context from the previous one is attached to their events.
    reset() {
      call('stopSession');
      call('clearUser');
      call('clearAccount');
      call('setGlobalContext', {});
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

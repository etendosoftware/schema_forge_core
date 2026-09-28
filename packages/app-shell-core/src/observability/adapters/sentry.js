/**
 * Sentry/GlitchTip adapter for the telemetry gateway (ETP-4578, PRD WS-3).
 *
 * The SDK is INJECTED (`sdk` is the `@sentry/react` namespace the host imports), so this
 * package never imports a provider SDK and the provider-import guard stays strict.
 *
 * Most of what Sentry sends never passes through the gateway: global error handlers,
 * automatic breadcrumbs (console, fetch/XHR, clicks, navigation) and tracing spans are
 * produced inside the SDK. That egress is closed here, in the SDK's own hooks —
 * `beforeSend`, `beforeSendTransaction`, `beforeSendSpan` and `beforeBreadcrumb` — which
 * rebuild each payload field by field from an explicit list (see `./shared.js`).
 *
 * Fixed, not configurable: `sendDefaultPii: false` (D4), `sampleRate: 1` (every error)
 * and a 10% default trace sample. What IS configurable is the D7-type approval of SDK
 * fields, with conservative defaults: request headers (none), span data keys and
 * breadcrumb data keys (below).
 */
import { normalizeRoute, sanitizeStack, sanitizeValue } from '../sanitize.js';
import { compact, pickMeasurements, pickScalars, safeWarn, sanitizeText } from './shared.js';

export const DEFAULT_TRACES_SAMPLE_RATE = 0.1;
// Below the gateway's DEFAULT_ADAPTER_TIMEOUT_MS (2000), so close()/flush() give up first.
export const DEFAULT_CLOSE_TIMEOUT_MS = 1000;

/** Span `data` keys an HTTP or navigation span may keep; everything else is dropped. */
export const DEFAULT_APPROVED_SPAN_DATA_KEYS = [
  'http.method',
  'http.request.method',
  'http.response.status_code',
  'http.status_code',
  'url',
  'http.url',
  'server.address',
  'type',
  'sentry.op',
  'sentry.origin',
  'sentry.source',
  'sentry.sample_rate',
  'sentry.idle_span_finish_reason',
];

/** Breadcrumb `data` keys the automatic breadcrumbs may keep (fetch/XHR, navigation). */
export const DEFAULT_APPROVED_BREADCRUMB_DATA_KEYS = ['method', 'url', 'status_code', 'from', 'to'];

const EVENT_SCALARS = [
  'event_id', 'type', 'timestamp', 'start_timestamp', 'level', 'platform', 'logger',
  'release', 'dist', 'environment',
];
const TRACE_CONTEXT_SCALARS = ['trace_id', 'span_id', 'parent_span_id', 'op', 'status', 'origin'];
const SPAN_SCALARS = [
  'span_id', 'trace_id', 'parent_span_id', 'op', 'status', 'origin', 'start_timestamp',
  'timestamp', 'exclusive_time', 'is_segment', 'segment_id', 'profile_id',
];
const SPAN_ID_SCALARS = ['span_id', 'trace_id', 'parent_span_id', 'start_timestamp', 'timestamp'];
const FRAME_SCALARS = ['lineno', 'colno', 'in_app'];
const BREADCRUMB_SCALARS = ['type', 'category', 'level', 'timestamp', 'event_id'];

function resolvePolicy(policy = {}) {
  const allowedKeys = Array.from(policy.allowedKeys ?? []);
  return {
    options: { ...(policy.limits ?? {}), allowedKeys },
    approvedRequestHeaders: Array.from(policy.approvedRequestHeaders ?? []),
    spanOptions: {
      ...(policy.limits ?? {}),
      allowedKeys: Array.from(policy.approvedSpanDataKeys ?? DEFAULT_APPROVED_SPAN_DATA_KEYS),
    },
    breadcrumbOptions: {
      ...(policy.limits ?? {}),
      allowedKeys: [...allowedKeys, ...(policy.approvedBreadcrumbDataKeys ?? DEFAULT_APPROVED_BREADCRUMB_DATA_KEYS)],
    },
    keepConsoleBreadcrumbs: policy.keepConsoleBreadcrumbs === true,
  };
}

// Console output is free text the secret scrub cannot judge: a customer name logged with
// console.error would travel attached to every later error. Off unless the host opts in.
function isDroppedBreadcrumb(crumb, resolved) {
  return !resolved.keepConsoleBreadcrumbs && crumb?.category === 'console';
}

function sanitizeFrame(frame, resolved) {
  return compact({
    filename: sanitizeText(frame?.filename, resolved.options),
    abs_path: sanitizeText(frame?.abs_path, resolved.options),
    function: sanitizeText(frame?.function, resolved.options),
    module: sanitizeText(frame?.module, resolved.options),
    ...pickScalars(frame, FRAME_SCALARS),
  });
}

function sanitizeException(exception, resolved) {
  const frames = exception?.stacktrace?.frames;
  return compact({
    type: sanitizeText(exception?.type, resolved.options),
    value: sanitizeText(exception?.value, resolved.options),
    mechanism: exception?.mechanism ? pickScalars(exception.mechanism, ['type', 'handled', 'synthetic']) : undefined,
    stacktrace: Array.isArray(frames) ? { frames: frames.map((frame) => sanitizeFrame(frame, resolved)) } : undefined,
  });
}

function sanitizeRequest(request, resolved) {
  if (!request || typeof request !== 'object') return undefined;
  const approved = new Map(resolved.approvedRequestHeaders.map((name) => [name.toLowerCase(), name]));
  const headers = {};
  for (const [name, value] of Object.entries(request.headers ?? {})) {
    if (approved.has(name.toLowerCase()) && typeof value === 'string') {
      headers[name] = sanitizeText(value, resolved.options);
    }
  }
  return compact({
    url: sanitizeText(request.url, resolved.options),
    method: typeof request.method === 'string' ? request.method : undefined,
    headers: Object.keys(headers).length > 0 ? headers : undefined,
  });
}

function sanitizeContexts(contexts, resolved) {
  if (!contexts || typeof contexts !== 'object') return undefined;
  return compact({
    app: contexts.app ? sanitizeValue(contexts.app, resolved.options) : undefined,
    trace: contexts.trace ? pickScalars(contexts.trace, TRACE_CONTEXT_SCALARS) : undefined,
  });
}

function sanitizeDebugMeta(debugMeta, resolved) {
  const images = debugMeta?.images;
  if (!Array.isArray(images)) return undefined;
  return {
    images: images.map((image) => compact({
      ...pickScalars(image, ['type', 'debug_id']),
      code_file: sanitizeText(image?.code_file, resolved.options),
    })),
  };
}

function sanitizeSpanWith(span, resolved) {
  return compact({
    ...pickScalars(span, SPAN_SCALARS),
    description: sanitizeText(span?.description, resolved.options),
    data: span?.data ? sanitizeValue(span.data, resolved.spanOptions) : undefined,
    measurements: pickMeasurements(span?.measurements),
  });
}

function sanitizeBreadcrumbWith(crumb, resolved) {
  return compact({
    ...pickScalars(crumb, BREADCRUMB_SCALARS),
    message: sanitizeText(crumb?.message, resolved.options),
    data: crumb?.data ? sanitizeValue(crumb.data, resolved.breadcrumbOptions) : undefined,
  });
}

/**
 * Rebuilds a Sentry error or transaction event from an explicit field list. `user`,
 * `modules`, `threads`, request cookies/query/body, frame source context and local
 * variables never survive; tags, extra and `contexts.app` are filtered through the
 * gateway allowlist (`policy.allowedKeys`).
 */
export function sanitizeSentryEvent(event, policy = {}) {
  const resolved = resolvePolicy(policy);
  const values = event?.exception?.values;
  return compact({
    ...pickScalars(event, EVENT_SCALARS),
    sdk: event?.sdk ? pickScalars(event.sdk, ['name', 'version']) : undefined,
    message: sanitizeText(event?.message, resolved.options),
    logentry: event?.logentry ? compact({ message: sanitizeText(event.logentry.message, resolved.options) }) : undefined,
    transaction: typeof event?.transaction === 'string'
      ? sanitizeValue(normalizeRoute(event.transaction), resolved.options)
      : undefined,
    transaction_info: event?.transaction_info ? pickScalars(event.transaction_info, ['source']) : undefined,
    exception: Array.isArray(values) ? { values: values.map((value) => sanitizeException(value, resolved)) } : undefined,
    breadcrumbs: Array.isArray(event?.breadcrumbs)
      ? event.breadcrumbs
        .filter((crumb) => !isDroppedBreadcrumb(crumb, resolved))
        .map((crumb) => sanitizeBreadcrumbWith(crumb, resolved))
      : undefined,
    request: sanitizeRequest(event?.request, resolved),
    tags: event?.tags ? sanitizeValue(event.tags, resolved.options) : undefined,
    extra: event?.extra ? sanitizeValue(event.extra, resolved.options) : undefined,
    contexts: sanitizeContexts(event?.contexts, resolved),
    spans: Array.isArray(event?.spans) ? event.spans.map((span) => sanitizeSpanWith(span, resolved)) : undefined,
    measurements: pickMeasurements(event?.measurements),
    debug_meta: sanitizeDebugMeta(event?.debug_meta, resolved),
    fingerprint: Array.isArray(event?.fingerprint)
      ? event.fingerprint.map((part) => sanitizeText(String(part), resolved.options))
      : undefined,
  });
}

/** A sanitized breadcrumb, or null for one that is dropped outright (console, by default). */
export function sanitizeSentryBreadcrumb(crumb, policy = {}) {
  const resolved = resolvePolicy(policy);
  return isDroppedBreadcrumb(crumb, resolved) ? null : sanitizeBreadcrumbWith(crumb, resolved);
}

export function sanitizeSentrySpan(span, policy = {}) {
  return sanitizeSpanWith(span, resolvePolicy(policy));
}

/**
 * @param {object} options
 * @param {object} options.sdk The injected `@sentry/react` namespace.
 * @param {string} [options.dsn] Enables the adapter; without it nothing is ever sent.
 * @param {string} [options.environment]
 * @param {string} [options.release]
 * @param {Array<string|RegExp>} [options.tracePropagationTargets]
 * @param {number} [options.tracesSampleRate]
 * @param {Iterable<string>} [options.allowedKeys] The gateway allowlist, applied to tags,
 *   extra, `contexts.app` and breadcrumb data.
 * @param {Iterable<string>} [options.approvedRequestHeaders] Default none (D7).
 * @param {Iterable<string>} [options.approvedSpanDataKeys]
 * @param {Iterable<string>} [options.approvedBreadcrumbDataKeys]
 * @param {boolean} [options.keepConsoleBreadcrumbs] Off by default.
 * @param {number} [options.closeTimeoutMs] Bound on the SDK's close()/flush(); keep it below
 *   the gateway's adapterTimeoutMs.
 * @param {object} [options.limits] Forwarded to `sanitizeValue()` (maxStringLength, …).
 * @param {{warn?: Function}} [options.logger]
 */
export function createSentryAdapter({
  sdk,
  dsn,
  environment,
  release,
  tracePropagationTargets,
  tracesSampleRate = DEFAULT_TRACES_SAMPLE_RATE,
  allowedKeys,
  approvedRequestHeaders,
  approvedSpanDataKeys,
  approvedBreadcrumbDataKeys,
  keepConsoleBreadcrumbs = false,
  closeTimeoutMs = DEFAULT_CLOSE_TIMEOUT_MS,
  limits,
  logger = console,
} = {}) {
  const policy = {
    allowedKeys, approvedRequestHeaders, approvedSpanDataKeys, approvedBreadcrumbDataKeys, keepConsoleBreadcrumbs, limits,
  };
  // Set synchronously the moment the kill switch fires. Sentry v10's close() awaits a
  // flush BEFORE it disables the client, so without this flag the global handlers keep
  // capturing — and sending — for as long as a slow or hung endpoint holds close() up.
  let stopped = false;
  // Initialized and not closed since: a second init() (a retried start) is a no-op.
  let live = false;

  // A hook that throws would make the SDK send the original payload or crash its
  // pipeline; a failure here drops the payload instead of letting it out unsanitized.
  function guardedHook(name, sanitize, fallback = () => null) {
    return (payload) => {
      if (stopped) return fallback(payload);
      try {
        return sanitize(payload, policy);
      } catch (error) {
        safeWarn(logger, `[observability] sentry.${name} dropped a payload it could not sanitize`, error);
        return fallback(payload);
      }
    };
  }

  // beforeSendSpan cannot drop a span, so a failed (or post-kill) one is reduced to its
  // ids; the transaction carrying it is dropped by beforeSendTransaction anyway.
  const spanFallback = (span) => ({ ...pickScalars(span, SPAN_ID_SCALARS), data: {} });

  const call = (method, ...args) => (typeof sdk?.[method] === 'function' ? sdk[method](...args) : undefined);

  function disableClient() {
    try {
      const options = sdk?.getClient?.()?.getOptions?.();
      if (options) options.enabled = false;
    } catch {
      // Best effort: the stopped flag already drops everything.
    }
  }

  return {
    name: 'sentry',
    enabled: Boolean(dsn),

    init({ context } = {}) {
      stopped = false;
      if (live) {
        if (context) call('setContext', 'app', context);
        return;
      }
      live = true;
      call('init', {
        dsn,
        environment,
        release,
        integrations: typeof sdk?.browserTracingIntegration === 'function' ? [sdk.browserTracingIntegration()] : [],
        sampleRate: 1,
        tracesSampleRate,
        tracePropagationTargets,
        sendDefaultPii: false,
        beforeSend: guardedHook('beforeSend', sanitizeSentryEvent),
        beforeSendTransaction: guardedHook('beforeSendTransaction', sanitizeSentryEvent),
        beforeSendSpan: guardedHook('beforeSendSpan', sanitizeSentrySpan, spanFallback),
        beforeBreadcrumb: guardedHook('beforeBreadcrumb', sanitizeSentryBreadcrumb),
      });
      if (context) call('setContext', 'app', context);
    },

    /**
     * Hot kill. The order matters: the stopped flag drops every hook's payload at once,
     * then the client is disabled (which also stops sessions and client reports), and only
     * then is close() awaited — bounded, since a hung endpoint would hold it forever.
     */
    async shutdown() {
      stopped = true;
      disableClient();
      live = false;
      await call('close', closeTimeoutMs);
    },

    reset() {
      if (!stopped) call('setUser', null);
    },

    /** The gateway hands over an already-sanitized `{ name, message, stack }`, never the raw Error. */
    captureException(summary, details = {}) {
      if (stopped) return;
      const error = new Error(typeof summary?.message === 'string' ? summary.message : '');
      if (typeof summary?.name === 'string') error.name = summary.name;
      if (typeof summary?.stack === 'string') error.stack = sanitizeStack(summary.stack, policy.limits);
      call('captureException', error, { extra: details });
    },

    breadcrumb(crumb) {
      if (!stopped) call('addBreadcrumb', crumb);
    },

    setContext(context) {
      if (!stopped) call('setContext', 'app', context);
    },

    async flush() {
      await call('flush', closeTimeoutMs);
    },
  };
}

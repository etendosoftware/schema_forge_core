/**
 * AWS CloudWatch RUM adapter for the telemetry gateway (ETP-4578, PRD WS-3).
 *
 * The SDK is INJECTED (`sdk` is the `aws-rum-web` module the host imports), so this package
 * never imports a provider SDK and the SDK is only constructed when the provider is enabled.
 *
 * RUM records everything on its own (page views, JS errors, HTTP calls, performance) and,
 * unlike Sentry or Mixpanel, has no generic before-send hook. Captured from the real SDK
 * (1.25), every event's metadata carries `document.title` (e.g. a customer name and a
 * document number) and the page id with the record id in it; error and HTTP details carry
 * raw messages, stacks and URLs with their query.
 *
 * The one pre-signing interception point is the public `clientBuilder` option. Dispatch
 * invokes it as a method, so a regular function receives `this` = the Dispatch instance
 * and can obtain the real data-plane client from its `defaultClientBuilder`, then wrap
 * `sendFetch`/`sendBeacon`: the PutRumEventsRequest is sanitized BEFORE the client
 * serializes and SigV4-signs it, so the signature covers exactly what is sent (verified
 * against the real SDK). `defaultClientBuilder` is a private member: if a future SDK
 * version drops it, the builder FAILS CLOSED — it returns a client that sends nothing —
 * and the host's real-SDK test (H4c) turns red.
 *
 * Configurable from the host, with conservative defaults: approved metadata and detail
 * keys, cookies (off), sample rate and telemetries.
 */
import { normalizeRoute, sanitizeStack, sanitizeValue } from '../sanitize.js';
import { pickScalars, safeWarn } from './shared.js';

export const DEFAULT_RUM_REGION = 'eu-west-3';
export const DEFAULT_RUM_SESSION_SAMPLE_RATE = 0.1;
export const DEFAULT_RUM_TELEMETRIES = ['performance', 'errors', 'http'];

/** Event metadata kept by default: environment facts, never the page title or URLs. */
export const DEFAULT_APPROVED_METADATA_KEYS = [
  'version', 'browserLanguage', 'browserName', 'browserVersion', 'osName', 'osVersion',
  'deviceType', 'platformType', 'domain', 'pageId', 'parentPageId', 'interaction',
  'aws:client', 'aws:clientVersion',
];

/** Event detail keys kept by default, across the event types the SDK records. */
export const DEFAULT_APPROVED_DETAIL_KEYS = [
  // common
  'version', 'type', 'value', 'duration', 'startTime',
  // page views
  'pageId', 'parentPageId', 'pageInteractionId', 'parentPageInteractionId', 'interaction', 'timeOnParentPage',
  // errors and HTTP
  'message', 'filename', 'lineno', 'colno', 'stack', 'request', 'response', 'method', 'url', 'status',
  'statusText', 'error', 'trace_id', 'segment_id',
  // resources and navigation timing
  'targetUrl', 'initiatorType', 'fileType', 'transferSize', 'headerSize', 'compressionRatio',
  'nextHopProtocol', 'redirectStart', 'redirectTime', 'workerStart', 'workerTime', 'fetchStart',
  'domainLookupStart', 'dns', 'connectStart', 'connect', 'secureConnectionStart', 'tlsTime',
  'requestStart', 'timeToFirstByte', 'responseStart', 'responseTime', 'domInteractive',
  'domContentLoadedEventStart', 'domContentLoaded', 'domComplete', 'domProcessingTime',
  'loadEventStart', 'loadEventTime', 'navigationType', 'navigationTimingLevel',
  // web vitals (their attribution objects keep timings, not element selectors)
  'attribution', 'resourceLoadDelay', 'resourceLoadTime', 'elementRenderDelay', 'largestShiftValue',
  'largestShiftTime', 'loadState', 'eventType', 'eventTime', 'inputDelay', 'processingDuration',
  'presentationDelay', 'rating',
];

const PAGE_ID_KEYS = ['pageId', 'parentPageId'];
const PAGE_INTERACTION_KEYS = ['pageInteractionId', 'parentPageInteractionId'];

/** `/sales-order/<id>-3` → `/sales-order/:id-3`: normalize the page id, keep the interaction. */
function normalizePageInteractionId(value) {
  const match = /^(.*)-(\d+)$/.exec(value);
  return match ? `${normalizeRoute(match[1])}-${match[2]}` : normalizeRoute(value);
}

function preNormalize(source, { pageIds = [], interactions = [] }) {
  const out = { ...source };
  for (const key of pageIds) if (typeof out[key] === 'string') out[key] = normalizeRoute(out[key]);
  for (const key of interactions) if (typeof out[key] === 'string') out[key] = normalizePageInteractionId(out[key]);
  return out;
}

function sanitizeDetails(details, options) {
  const normalized = preNormalize(details, { pageIds: PAGE_ID_KEYS, interactions: PAGE_INTERACTION_KEYS });
  const out = sanitizeValue(normalized, options);
  // Stacks go frame by frame, at the top level and inside an HTTP event's error.
  if (typeof details.stack === 'string') out.stack = sanitizeStack(details.stack, options);
  if (typeof details.error?.stack === 'string' && out.error && typeof out.error === 'object') {
    out.error.stack = sanitizeStack(details.error.stack, options);
  }
  return out;
}

function resolvePolicy(policy = {}) {
  const limits = policy.limits ?? {};
  return {
    metadataOptions: { ...limits, allowedKeys: Array.from(policy.approvedMetadataKeys ?? []).concat(DEFAULT_APPROVED_METADATA_KEYS) },
    detailOptions: { ...limits, allowedKeys: Array.from(policy.approvedDetailKeys ?? []).concat(DEFAULT_APPROVED_DETAIL_KEYS) },
  };
}

function sanitizeEvent(event, resolved) {
  try {
    const metadata = preNormalize(JSON.parse(event.metadata ?? '{}'), { pageIds: PAGE_ID_KEYS });
    const details = JSON.parse(event.details ?? '{}');
    return {
      id: event.id,
      timestamp: event.timestamp,
      type: event.type,
      metadata: JSON.stringify(sanitizeValue(metadata, resolved.metadataOptions)),
      details: JSON.stringify(sanitizeDetails(details, resolved.detailOptions)),
    };
  } catch {
    return null; // An event we cannot parse is dropped, never forwarded as-is.
  }
}

/**
 * Rebuilds a PutRumEventsRequest: batch, monitor and anonymous session identity, and each
 * event's metadata and details through their allowlists.
 */
export function sanitizeRumRequest(request, policy = {}) {
  const resolved = resolvePolicy(policy);
  const events = Array.isArray(request?.RumEvents) ? request.RumEvents : [];
  return {
    BatchId: request?.BatchId,
    AppMonitorDetails: pickScalars(request?.AppMonitorDetails, ['id', 'version', 'alias']),
    UserDetails: pickScalars(request?.UserDetails, ['userId', 'sessionId']),
    RumEvents: events.map((event) => sanitizeEvent(event, resolved)).filter(Boolean),
  };
}

// What the dispatcher sees for a dropped batch: success, so it clears the batch instead of
// retrying it or disabling itself.
const DROPPED = Object.freeze({ response: Object.freeze({ statusCode: 200 }) });

/**
 * @param {object} options
 * @param {{AwsRum: Function}} options.sdk The injected `aws-rum-web` module.
 * @param {boolean|string} [options.enabled] Explicit opt-in; off by default (D3).
 * @param {string} [options.appMonitorId]
 * @param {string} [options.identityPoolId]
 * @param {string} [options.region]
 * @param {string} [options.endpoint]
 * @param {string} [options.applicationVersion]
 * @param {number} [options.sessionSampleRate]
 * @param {boolean} [options.allowCookies] Off by default (consent is an open decision).
 * @param {Array<string>} [options.telemetries]
 * @param {Iterable<string>} [options.approvedMetadataKeys] Added to the defaults.
 * @param {Iterable<string>} [options.approvedDetailKeys] Added to the defaults.
 * @param {object} [options.limits] Forwarded to `sanitizeValue()`.
 * @param {{warn?: Function}} [options.logger]
 */
export function createRumAdapter({
  sdk,
  enabled = false,
  appMonitorId,
  identityPoolId,
  region = DEFAULT_RUM_REGION,
  endpoint,
  applicationVersion = '1.0.0',
  sessionSampleRate = DEFAULT_RUM_SESSION_SAMPLE_RATE,
  allowCookies = false,
  telemetries = DEFAULT_RUM_TELEMETRIES,
  approvedMetadataKeys,
  approvedDetailKeys,
  limits,
  logger = console,
} = {}) {
  const optedIn = enabled === true || enabled === 'true';
  const policy = { approvedMetadataKeys, approvedDetailKeys, limits };
  let rum;

  function sanitizingSend(send) {
    return async (request) => {
      let sanitized;
      try {
        sanitized = sanitizeRumRequest(request, policy);
      } catch (error) {
        safeWarn(logger, '[observability] aws-rum dropped a batch it could not sanitize', error);
        return DROPPED;
      }
      return send(sanitized);
    };
  }

  // A regular function on purpose: Dispatch calls it as a method, and `this` is how the
  // real data-plane client is reached (see the header comment).
  function clientBuilder(builderEndpoint, builderRegion, credentials) {
    if (typeof this?.defaultClientBuilder !== 'function') {
      safeWarn(logger, '[observability] aws-rum: the SDK no longer exposes defaultClientBuilder; sending nothing (fail closed)');
      return { sendFetch: async () => DROPPED, sendBeacon: async () => DROPPED };
    }
    const client = this.defaultClientBuilder(builderEndpoint, builderRegion, credentials);
    return {
      sendFetch: sanitizingSend((request) => client.sendFetch(request)),
      sendBeacon: sanitizingSend((request) => client.sendBeacon(request)),
    };
  }

  return {
    name: 'aws-rum',
    enabled: optedIn && Boolean(appMonitorId && identityPoolId),

    async init() {
      if (rum) {
        rum.enable?.();
        return;
      }
      try {
        rum = new sdk.AwsRum(appMonitorId, applicationVersion, region, {
          identityPoolId,
          endpoint: endpoint ?? `https://dataplane.rum.${region}.amazonaws.com`,
          sessionSampleRate,
          telemetries,
          allowCookies: Boolean(allowCookies),
          enableXRay: false,
          clientBuilder,
        });
      } catch (error) {
        safeWarn(logger, '[observability] aws-rum init failed', error);
      }
    },

    /** Hot kill: stops dispatch and the SDK's own recording. */
    shutdown() {
      rum?.disable?.();
    },

    captureException(summary) {
      if (typeof rum?.recordError !== 'function') return;
      const error = new Error(typeof summary?.message === 'string' ? summary.message : '');
      if (typeof summary?.name === 'string') error.name = summary.name;
      if (typeof summary?.stack === 'string') error.stack = summary.stack;
      rum.recordError(error);
    },
  };
}

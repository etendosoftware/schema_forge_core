/**
 * Provider-independent telemetry egress gateway (ETP-4577, PRD WS-3 "Telemetry egress
 * governance"). The single deny-by-default boundary between application code and any
 * observability provider (Sentry/GlitchTip, AWS RUM, Mixpanel, …).
 *
 * Every outbound operation — track, page, identify, group, groupSet, captureException,
 * breadcrumb, setContext — is sanitized here (see `./sanitize.js`) before it ever
 * reaches an adapter. Adapter dispatch mirrors the resilience contract the functional
 * host's `lib/observability/core.js` already had: an adapter that throws, or one that
 * is disabled, never blocks another adapter or the caller — telemetry failure must
 * never become a product failure.
 *
 * Relocating the real provider adapters (Sentry/RUM/Mixpanel) into this package,
 * wiring their kill switches, and writing the `docs/security/telemetry-egress.md`
 * inventory are ETP-4578's scope, not this one. `provider-import-guard.test.js`
 * enforces that nothing outside this module talks to a provider SDK directly.
 */
import { sanitizeValue } from './sanitize.js';

function isAdapterEnabled(adapter) {
  return Boolean(adapter) && adapter.enabled !== false;
}

function adapterName(adapter) {
  return adapter?.name || 'unknown-adapter';
}

async function callAdapter(adapter, methodName, args, logger) {
  const method = adapter?.[methodName];
  if (typeof method !== 'function') return undefined;

  try {
    return await method.apply(adapter, args);
  } catch (error) {
    if (typeof logger?.warn === 'function') {
      logger.warn(`[observability] ${adapterName(adapter)}.${methodName} failed`, error);
    }
    return undefined;
  }
}

function stripRoute(path) {
  const raw = String(path ?? '/');
  const idx = raw.search(/[?#]/);
  return idx === -1 ? raw : raw.slice(0, idx);
}

/**
 * @param {object} options
 * @param {Array<object>} [options.adapters] Provider adapters. Each may implement any
 *   subset of track/page/identify/group/groupSet/captureException/breadcrumb/setContext/
 *   flush; missing methods are silently skipped. `{ enabled: false }` disables one.
 * @param {Iterable<string>} [options.allowedKeys] Forwarded to every `sanitizeValue`
 *   call — see `./sanitize.js` for the deny-by-default contract.
 * @param {{warn?: Function}} [options.logger]
 * @param {number} [options.maxDepth]
 * @param {number} [options.maxKeys]
 * @param {number} [options.maxArrayLength]
 * @param {number} [options.maxStringLength]
 */
export function createTelemetryGateway({
  adapters: initialAdapters = [],
  allowedKeys = [],
  logger = console,
  maxDepth,
  maxKeys,
  maxArrayLength,
  maxStringLength,
} = {}) {
  const adapters = initialAdapters.filter(isAdapterEnabled);
  let context = {};
  const sanitizeOptions = { allowedKeys, maxDepth, maxKeys, maxArrayLength, maxStringLength };

  function sanitize(value) {
    return sanitizeValue(value, sanitizeOptions);
  }

  function sanitizeError(error) {
    if (!error) return error;
    const isErrorLike = typeof error === 'object';
    const message = isErrorLike ? error.message : String(error);
    const name = isErrorLike ? error.name : undefined;
    const stack = isErrorLike && typeof error.stack === 'string' ? error.stack : undefined;

    return {
      name: typeof name === 'string' ? sanitizeValue(name, sanitizeOptions) : undefined,
      message: typeof message === 'string' ? sanitizeValue(message, sanitizeOptions) : undefined,
      stack: stack ? sanitizeValue(stack, sanitizeOptions) : undefined,
    };
  }

  function dispatch(methodName, args) {
    return Promise.all(adapters.map((adapter) => callAdapter(adapter, methodName, args, logger)));
  }

  return {
    async track(eventName, properties = {}) {
      if (!eventName) return;
      await dispatch('track', [String(eventName), sanitize(properties), { context: sanitize(context) }]);
    },

    async page(path, properties = {}) {
      const route = stripRoute(path);
      await dispatch('page', [route, sanitize(properties), { context: sanitize(context) }]);
    },

    async identify(userId, traits = {}) {
      if (!userId) return;
      await dispatch('identify', [String(userId), sanitize(traits), { context: sanitize(context) }]);
    },

    async group(groupKey, groupId, traits = {}) {
      if (!groupKey || !groupId) return;
      await dispatch('group', [
        String(groupKey),
        String(groupId),
        sanitize(traits),
        { context: sanitize(context) },
      ]);
    },

    async groupSet(groupKey, groupId, properties = {}) {
      if (!groupKey || !groupId) return;
      await dispatch('groupSet', [
        String(groupKey),
        String(groupId),
        sanitize(properties),
        { context: sanitize(context) },
      ]);
    },

    async captureException(error, details = {}) {
      if (!error) return;
      await dispatch('captureException', [sanitizeError(error), sanitize(details), { context: sanitize(context) }]);
    },

    async breadcrumb(crumb = {}) {
      await dispatch('breadcrumb', [sanitize(crumb)]);
    },

    async setContext(nextContext = {}) {
      context = { ...context, ...sanitize(nextContext) };
      await dispatch('setContext', [sanitize(context)]);
    },

    async flush() {
      await dispatch('flush', []);
    },

    getContext() {
      return sanitize(context);
    },
  };
}

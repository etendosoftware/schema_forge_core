export { ObservabilityProvider, useObservability } from './ObservabilityContext.jsx';
// ETP-4577 — provider-independent sanitization gateway. Wiring a host's real provider
// adapters behind it, and switching `ObservabilityContext`'s default away from a no-op,
// is ETP-4578's scope; this export is what makes the gateway "reusable from
// app-shell-core" per that ticket's acceptance criterion.
export { createTelemetryGateway } from './gateway.js';
export { sanitizeValue, sanitizeStack, normalizeRoute } from './sanitize.js';
// A plain module or a `node --test` file must not import this barrel (it re-exports JSX):
// use the `/observability/gateway`, `/observability/sanitize` and
// `/observability/providerImportGuard` subpaths instead.
export { createSentryAdapter } from './adapters/sentry.js';
export { createMixpanelAdapter } from './adapters/mixpanel.js';
export { createRumAdapter } from './adapters/rum.js';
export { createDatadogAdapter } from './adapters/datadog.js';
export {
  findBannedProviderImports,
  isBannedProviderSpecifier,
  BANNED_PROVIDER_PREFIXES,
} from './providerImportGuard.js';

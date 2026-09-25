export { ObservabilityProvider, useObservability } from './ObservabilityContext.jsx';
// ETP-4577 — provider-independent sanitization gateway. Wiring a host's real provider
// adapters behind it, and switching `ObservabilityContext`'s default away from a no-op,
// is ETP-4578's scope; this export is what makes the gateway "reusable from
// app-shell-core" per that ticket's acceptance criterion.
export { createTelemetryGateway } from './gateway.js';
export { sanitizeValue } from './sanitize.js';

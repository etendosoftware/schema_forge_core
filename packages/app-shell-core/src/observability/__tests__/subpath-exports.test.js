import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// The `./observability` barrel re-exports ObservabilityContext.jsx, which plain
// `node --test` cannot load. A host module or test that only needs the gateway, the
// sanitizer or the provider-import guard must be able to reach them through a subpath
// that never touches JSX — the same reason `./auth/api` exists next to `./auth`.
// Resolving by package name (not a relative path) is what proves the `exports` map.

describe('app-shell-core plain observability subpaths', () => {
  it('exposes the provider-import guard', async () => {
    const guard = await import('@etendosoftware/app-shell-core/observability/providerImportGuard');
    assert.equal(typeof guard.findBannedProviderImports, 'function');
    assert.equal(typeof guard.isBannedProviderSpecifier, 'function');
    assert.ok(Array.isArray(guard.BANNED_PROVIDER_PREFIXES) && guard.BANNED_PROVIDER_PREFIXES.length > 0);
    assert.deepEqual(guard.findBannedProviderImports("import * as S from '@sentry/react';"), ['@sentry/react']);
  });

  it('exposes the gateway', async () => {
    const { createTelemetryGateway } = await import('@etendosoftware/app-shell-core/observability/gateway');
    assert.equal(typeof createTelemetryGateway, 'function');
  });

  it('exposes the sanitizer', async () => {
    const sanitize = await import('@etendosoftware/app-shell-core/observability/sanitize');
    assert.equal(typeof sanitize.sanitizeValue, 'function');
    assert.equal(typeof sanitize.normalizeRoute, 'function');
  });
});

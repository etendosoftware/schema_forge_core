import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findBannedProviderImports, BANNED_PROVIDER_PACKAGES } from '../providerImportGuard.js';

/**
 * ETP-4577 guardrail — "bypass imports fail CI" (Jira acceptance criterion).
 *
 * The telemetry gateway (`gateway.js`) is the ONLY place allowed to know a provider
 * SDK exists. Nothing else in this package may import one directly — that is exactly
 * the hole SEC-14 described: a component reaching for `@sentry/react` or
 * `mixpanel-browser` itself bypasses sanitization entirely, silently.
 *
 * There is no `observability/adapters/` directory yet — ETP-4578 introduces the real
 * provider adapters and MUST add its own directory to `ALLOWED_DIRS` below when it
 * does, the same deliberate, visible way `no-raw-fetch.test.js` (schema_forge host)
 * lists its exceptions. Until then, the allowlist is empty on purpose.
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = join(__dirname, '..', '..');

// Directories (relative to `src/`) allowed to import a provider SDK directly.
// Empty today — ETP-4578 adds `observability/adapters` here when it lands the adapters.
const ALLOWED_DIRS = [];

function collectSourceFiles(dir, acc = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === '__tests__' || entry === 'node_modules') continue;
      collectSourceFiles(full, acc);
      continue;
    }
    if (!/\.jsx?$/.test(entry)) continue;
    if (/\.(test|vitest)\.jsx?$/.test(entry)) continue;
    acc.push(full);
  }
  return acc;
}

function isAllowedFile(relativePath) {
  return ALLOWED_DIRS.some((dir) => relativePath.startsWith(dir + sep));
}

describe('provider import guard (ETP-4577)', () => {
  it('detects a banned provider import in a synthetic snippet (self-test of the scanner)', () => {
    const snippet = "import * as Sentry from '@sentry/react';\nimport mixpanel from 'mixpanel-browser';\n";
    const hits = findBannedProviderImports(snippet);
    assert.equal(hits.length, 2);
  });

  it('does not flag an import of the gateway itself or an unrelated package', () => {
    const snippet = "import { createTelemetryGateway } from './gateway.js';\nimport { z } from 'zod';\n";
    assert.deepEqual(findBannedProviderImports(snippet), []);
  });

  it('no source file in the package imports a provider SDK directly', () => {
    const offenders = [];
    for (const file of collectSourceFiles(SRC)) {
      const relPath = relative(SRC, file);
      if (isAllowedFile(relPath)) continue;
      const hits = findBannedProviderImports(readFileSync(file, 'utf8'));
      for (const hit of hits) offenders.push(`${relPath.split(sep).join('/')}: ${hit}`);
    }

    assert.deepEqual(
      offenders,
      [],
      'These files import a provider SDK directly, bypassing the sanitization gateway:\n'
      + offenders.map((o) => `  - ${o}`).join('\n')
      + '\n\nRoute all provider calls through createTelemetryGateway() (./gateway.js) instead.\n'
      + `Known provider packages: ${BANNED_PROVIDER_PACKAGES.join(', ')}\n`,
    );
  });
});

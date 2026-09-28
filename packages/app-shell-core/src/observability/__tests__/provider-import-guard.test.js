import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findBannedProviderImports, BANNED_PROVIDER_PREFIXES } from '../providerImportGuard.js';

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

  const DETECTED = {
    'a side-effect import': ["import '@sentry/react';", '@sentry/react'],
    'a dynamic import': ["const S = await import('@sentry/browser');", '@sentry/browser'],
    'a dynamic import with a template literal': ['const S = await import(`@sentry/${pkg}`);', '@sentry/${pkg}'],
    'a require': ["const mixpanel = require('mixpanel-browser');", 'mixpanel-browser'],
    'a require with a space before the parenthesis': ["const S = require ('aws-rum-web');", 'aws-rum-web'],
    'a re-export': ["export * from 'posthog-js';", 'posthog-js'],
    'a named re-export': ["export { init } from '@sentry/browser';", '@sentry/browser'],
    'any package under a banned scope': ["import * as S from '@sentry/vue';", '@sentry/vue'],
    'an internal Sentry package': ["import { x } from '@sentry-internal/replay';", '@sentry-internal/replay'],
    'a subpath of a banned package': ["import m from 'mixpanel-browser/src/loader';", 'mixpanel-browser/src/loader'],
    'a dynamic import carrying a bundler comment': ["import(/* webpackChunkName: 's' */ '@datadog/browser-rum')", '@datadog/browser-rum'],
    'an import after a string that looks like a comment opener': [
      "const routes = [{ path: '/app/*' }];\nconst S = await import('@sentry/react');\n/** doc */",
      '@sentry/react',
    ],
    'an import on the same line as a URL string': ["const u = 'https://x'; import S from '@sentry/react';", '@sentry/react'],
  };

  for (const [label, [snippet, specifier]] of Object.entries(DETECTED)) {
    it(`detects ${label}`, () => {
      assert.deepEqual(findBannedProviderImports(snippet), [specifier]);
    });
  }

  it('does not flag an import of the gateway itself or an unrelated package', () => {
    const snippet = "import { createTelemetryGateway } from './gateway.js';\nimport { z } from 'zod';\n";
    assert.deepEqual(findBannedProviderImports(snippet), []);
  });

  it('does not flag a commented-out import, a package name in a string, or a lookalike scope', () => {
    const snippet = [
      "// import * as Sentry from '@sentry/react';",
      "/* const m = require('mixpanel-browser'); */",
      "const docs = ['@sentry/react'];",
      "import x from '@sentryish/tools';",
      "import y from 'mixpanel-browser-lookalike';",
    ].join('\n');
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
      + `Banned package prefixes: ${BANNED_PROVIDER_PREFIXES.join(', ')}\n`,
    );
  });
});

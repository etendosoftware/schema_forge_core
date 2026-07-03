import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

// ---------------------------------------------------------------------------
// Regression test for ETP-4431 — calendar.jsx must never import the full
// `date-fns/locale` barrel.
//
// The barrel (`date-fns/locale`) re-exports ~87 locales. In production builds
// this tree-shakes away, but Vite's DEV SERVER serves unbundled ESM, so
// loading the barrel transitively fetches every locale's internal submodules
// (~530+ extra module requests). On a cold `.vite` cache — exactly what every
// CI build starts with — this made `page.goto()` take 30+ seconds and timed
// out 11 unrelated mocked E2E specs in CI, even for windows that don't render
// Calendar, because the dev server choked on this dependency fan-out the
// first time ANY page referencing it loaded.
//
// This test boots a real Vite dev server (no browser needed) and asks it to
// resolve + transitively transform whatever `date-fns/locale*` specifier(s)
// calendar.jsx actually imports — exactly what a browser's unbundled ESM
// requests would do. It fails if that specifier is (or transitively pulls in)
// the full barrel.
//
// Note: react-day-picker (a peer dependency of Calendar) ships its OWN
// internal `date-fns/locale` barrel import (in dist/esm/classes/DateLib.js),
// completely independent of how THIS file imports date-fns. That is a
// separate, larger contributor only neutralized on the consumer side via
// `optimizeDeps.include: ['react-day-picker']` in the consuming app's
// vite.config.js — out of scope for this repo. To keep the assertion focused
// on what calendar.jsx actually controls, this test resolves and measures
// ONLY the module graph reachable from calendar.jsx's own import
// specifier(s), not react-day-picker's independent locale wrappers.
// ---------------------------------------------------------------------------

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '../../../../../..');
const calendarPath = join(__dirname, '..', 'calendar.jsx');
const calendarSrc = readFileSync(calendarPath, 'utf8');

// Any import specifier of the form `date-fns/locale` or `date-fns/locale/xxx`.
const DATE_FNS_LOCALE_IMPORT_RE = /from\s+['"](date-fns\/locale[^'"]*)['"]/g;
const localeSpecifiers = [...calendarSrc.matchAll(DATE_FNS_LOCALE_IMPORT_RE)].map((m) => m[1]);

// A generous ceiling for a single-locale subpath's own transitive deps
// (the locale module + its `_lib` helpers). The full barrel pulls in 500+
// modules, so this threshold cleanly separates "one locale" from "all locales"
// without being so tight that unrelated date-fns internal changes break it.
const MAX_MODULES_PER_LOCALE_IMPORT = 30;

let server;

async function countTransitiveModules(entryId) {
  const seen = new Set();
  const queue = [entryId];

  while (queue.length > 0) {
    const id = queue.shift();
    if (seen.has(id)) continue;
    seen.add(id);

    let transformed;
    try {
      transformed = await server.transformRequest(id);
    } catch {
      continue;
    }
    if (!transformed) continue;

    const mod = await server.moduleGraph.getModuleByUrl(id);
    if (!mod) continue;

    for (const imported of mod.importedModules) {
      if (imported.id && !seen.has(imported.id)) {
        queue.push(imported.id);
      }
    }
  }

  return seen;
}

describe('calendar.jsx — date-fns/locale import (ETP-4431 regression)', () => {
  before(async () => {
    server = await createServer({
      root: repoRoot,
      configFile: false,
      logLevel: 'error',
      optimizeDeps: { noDiscovery: true, include: [] },
      server: { middlewareMode: true, hmr: false, fs: { strict: false } },
      appType: 'custom',
    });
  });

  after(async () => {
    await server.close();
  });

  it('imports at least one date-fns/locale specifier', () => {
    assert.ok(
      localeSpecifiers.length > 0,
      'expected calendar.jsx to import from date-fns/locale (directly or via subpath)'
    );
  });

  it('never imports the bare date-fns/locale barrel', () => {
    // This is the literal regression: `import { es, enUS } from 'date-fns/locale'`.
    // Guards the class of bug too — any future date-fns import must target a
    // specific locale subpath, never the barrel that re-exports all ~87.
    for (const specifier of localeSpecifiers) {
      assert.notEqual(
        specifier,
        'date-fns/locale',
        `calendar.jsx imports the full date-fns/locale barrel via "${specifier}" — ` +
          'this pulls in all ~87 locales on Vite\'s dev server and caused CI timeouts (ETP-4431). ' +
          'Import each locale from its own subpath instead, e.g. "date-fns/locale/es".'
      );
    }
  });

  it('each imported locale specifier resolves to a small, bounded module graph', async () => {
    assert.ok(localeSpecifiers.length > 0, 'no date-fns/locale specifiers found to check');

    for (const specifier of localeSpecifiers) {
      const resolved = await server.pluginContainer.resolveId(specifier, calendarPath);
      assert.ok(resolved?.id, `could not resolve specifier "${specifier}" from calendar.jsx`);

      const modules = await countTransitiveModules(resolved.id);

      assert.ok(
        modules.size <= MAX_MODULES_PER_LOCALE_IMPORT,
        `importing "${specifier}" pulled in ${modules.size} transitive modules ` +
          `(expected <= ${MAX_MODULES_PER_LOCALE_IMPORT}). This indicates the barrel ` +
          '(or something re-exporting all locales) is being loaded instead of a single ' +
          'locale subpath — the exact regression from ETP-4431.'
      );
    }
  });

  it('does not resolve any locale specifier to the barrel module itself', async () => {
    for (const specifier of localeSpecifiers) {
      const resolved = await server.pluginContainer.resolveId(specifier, calendarPath);
      assert.ok(resolved?.id);
      assert.doesNotMatch(
        resolved.id,
        /date-fns[/\\]locale\.(js|mjs|cjs)$/,
        `specifier "${specifier}" resolved to the date-fns/locale barrel file (${resolved.id})`
      );
    }
  });
});

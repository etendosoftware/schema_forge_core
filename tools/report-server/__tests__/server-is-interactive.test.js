/**
 * ETP-5013 — drill-down link styling (blue `#2563eb` + underline) must only
 * render for the on-screen preview (`format: 'html'`/`'preview'`), never for
 * a static PDF/Excel/CSV export where the same `onclick` postMessage does
 * nothing. `server.js` derives `const isInteractive = format === 'html' ||
 * format === 'preview'` and forwards it through `buildTemplateData()` on
 * BOTH the document branch (print-* reports) and the listing branch, into
 * `templateData.meta.isInteractive` — the exact field the 6 affected
 * `template.hbs` files gate their `.xxx-link` CSS rule on.
 *
 * `server.js` starts an HTTP listener on import (see
 * `server-pdf-chrome-payload.test.js`), so — following that same
 * replication convention — this suite asserts against the real source text
 * rather than driving a live request. `buildTemplateData` is a small pure
 * function immediately below the module-level listener start, so it is also
 * exercised directly here via dynamic `import()` + a bare function call
 * (no HTTP, no DB) for full behavioral coverage of the isInteractive
 * plumbing, not just its presence in the source.
 *
 * The identical logic lives in the dev-time engine
 * (`schema_forge/tools/app-shell/vite-plugins/report-api.js`), covered by
 * `report-api-is-interactive.test.js` in that repo — the two engines are
 * hand-maintained copies by design (see docs/repo-topology.md).
 */
import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const SERVER_SRC = readFileSync(fileURLToPath(new URL('../server.js', import.meta.url)), 'utf8');

describe('server.js source — isInteractive wiring (ETP-5013)', () => {
  it('derives isInteractive from format === html || format === preview', () => {
    assert.match(SERVER_SRC, /const isInteractive = format === 'html' \|\| format === 'preview';/);
  });

  it('passes isInteractive into buildTemplateData(...)', () => {
    const callSite = SERVER_SRC.match(/const templateData = buildTemplateData\([\s\S]*?\);/);
    assert.ok(callSite, 'could not locate the buildTemplateData(...) call site');
    assert.match(callSite[0], /isInteractive/);
  });

  it('buildTemplateData destructures isInteractive from its options param', () => {
    const signature = SERVER_SRC.match(/function buildTemplateData\([\s\S]*?\)\s*\{/);
    assert.ok(signature, 'could not locate the buildTemplateData function signature');
    assert.match(signature[0], /isInteractive/);
  });

  it('forwards isInteractive on the document branch (print-* reports)', () => {
    const fnBody = SERVER_SRC.match(/function buildTemplateData\([\s\S]*?\n\}/);
    assert.ok(fnBody, 'could not locate the buildTemplateData function body');
    const docBranch = fnBody[0].match(/if \(documentData\) \{\s*return \{[\s\S]*?\};\s*\}/);
    assert.ok(docBranch, 'could not locate the documentData branch inside buildTemplateData');
    assert.match(docBranch[0], /isInteractive/);
  });

  it('forwards isInteractive on the listing branch', () => {
    const fnBody = SERVER_SRC.match(/function buildTemplateData\([\s\S]*?\n\}/);
    assert.ok(fnBody, 'could not locate the buildTemplateData function body');
    const listingBranch = fnBody[0].match(/return \{ css, meta: \{[\s\S]*?\}, rows \};/);
    assert.ok(listingBranch, 'could not locate the listing-branch return statement');
    assert.match(listingBranch[0], /isInteractive/);
  });
});

describe('buildTemplateData(...) behavior — isInteractive passthrough', () => {
  // server.js starts an HTTP listener as a side effect of being imported, so
  // it cannot be imported directly in a test process. buildTemplateData is a
  // pure, self-contained function with no closures over server state —
  // re-declaring it here from the exact source slice keeps this a real
  // behavioral check (not just a regex match) while staying import-free.
  const fnSrc = SERVER_SRC.match(/function buildTemplateData\([\s\S]*?\n\}/)[0];
  // eslint-disable-next-line no-new-func
  const buildTemplateData = new Function(`return ${fnSrc}`)();

  it('sets meta.isInteractive=true on the listing branch for format=html', () => {
    const result = buildTemplateData(null, '/* css */', {
      title: 'Tax Report', activeFilters: [], params: {}, recordCount: 0, totals: {},
      groupLabel: undefined, descriptionLabel: undefined, neoMeta: {}, rows: [],
      locale: 'en_US', ui: {}, labels: {}, dimensionLabel: undefined, dimensionField: undefined,
      groups: null, tbGroups: undefined, companyLogoDataUrl: undefined, isInteractive: true,
    });
    assert.equal(result.meta.isInteractive, true);
  });

  it('sets meta.isInteractive=false on the listing branch for format=pdf', () => {
    const result = buildTemplateData(null, '/* css */', {
      title: 'Tax Report', activeFilters: [], params: {}, recordCount: 0, totals: {},
      groupLabel: undefined, descriptionLabel: undefined, neoMeta: {}, rows: [],
      locale: 'en_US', ui: {}, labels: {}, dimensionLabel: undefined, dimensionField: undefined,
      groups: null, tbGroups: undefined, companyLogoDataUrl: undefined, isInteractive: false,
    });
    assert.equal(result.meta.isInteractive, false);
  });

  it('sets meta.isInteractive=true on the document branch for format=html', () => {
    const documentData = { header: { org_name: 'Acme' }, lines: [], taxes: [] };
    const result = buildTemplateData(documentData, '/* css */', {
      title: 'Purchase Order', activeFilters: [], params: {}, locale: 'en_US', ui: {}, labels: {},
      isInteractive: true,
    });
    assert.equal(result.meta.isInteractive, true);
    assert.equal(result.header, documentData.header);
  });

  it('sets meta.isInteractive=false on the document branch for format=pdf', () => {
    const documentData = { header: { org_name: 'Acme' }, lines: [], taxes: [] };
    const result = buildTemplateData(documentData, '/* css */', {
      title: 'Purchase Order', activeFilters: [], params: {}, locale: 'en_US', ui: {}, labels: {},
      isInteractive: false,
    });
    assert.equal(result.meta.isInteractive, false);
  });
});

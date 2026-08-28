/**
 * Regression guards for ETP-4908 — "Missing helper: qrCode" in production.
 *
 * The report server renders document templates through ONLY the canonical
 * helper whitelist (`registerReportHelpers` in
 * `templates/reports/helpers/report-html-helpers.js`); per-report `helpers.js`
 * text is read but never executed (post-ETP-4083, no `new Function`/`eval`).
 * A template that invokes a helper outside that whitelist (e.g. the old
 * per-report `qrCode` helper) fails at render time with
 * `Missing helper: "qrCode"`.
 *
 * The fix moved the QR code out of Handlebars entirely: it is precomputed as
 * DATA (`header.qrDataUrl`) by `injectDocumentQr()`/`computeDocumentQrDataUrl()`
 * BEFORE the synchronous `Handlebars.compile()` call, and templates reference
 * it as `<img src="{{header.qrDataUrl}}">`.
 *
 * These tests exercise the REAL functions from report-html-helpers.js — the
 * same ones `tools/report-server/server.js` imports and composes — against a
 * representative document-template fixture, replicating only the two thin
 * server.js wrappers (`injectDocumentQr`, `renderTemplateWithHelpers`) since
 * server.js itself starts an HTTP listener on import (see server.test.js for
 * the same replication convention with the server's other private helpers).
 */
import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  registerReportHelpers,
  computeDocumentQrDataUrl,
} from '../../../templates/reports/helpers/report-html-helpers.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const _require = createRequire(import.meta.url);

const DOCUMENT_TEMPLATE = readFileSync(
  join(__dirname, 'fixtures', 'document-template.hbs'),
  'utf8',
);
const UNREGISTERED_HELPER_TEMPLATE = readFileSync(
  join(__dirname, 'fixtures', 'document-template-unregistered-helper.hbs'),
  'utf8',
);
const TEMPLATE_WITH_BRANDING_PARTIAL = readFileSync(
  join(__dirname, 'fixtures', 'document-template-with-branding.hbs'),
  'utf8',
);
const DOCUMENT_BRANDING_PARTIAL = readFileSync(
  join(__dirname, '..', '..', '..', 'templates', 'reports', 'document-branding.hbs'),
  'utf8',
);

const SAMPLE_HEADER = {
  doc_type: 'AR Invoice',
  documentno: 'INV-1001',
  dateinvoiced: '2026-08-10T00:00:00.000Z',
  bp_name: 'ACME Corp',
  grandtotal: '1210.00',
  currency: 'EUR',
  org_taxid: 'B12345678',
  status: 'CO',
};

const SAMPLE_LINES = [
  { name: 'Widget A', qty: 3, unitPrice: 10.5 },
  { name: 'Widget B', qty: 1, unitPrice: 189.5 },
];

// --- Replicated server.js wrappers (see docstring above for why) ---
// These call the REAL imported functions — nothing here reimplements
// QR/helper logic, only the two-line composition server.js does around them.

async function injectDocumentQr(documentData, templateData) {
  if (!documentData?.header || !templateData.header) return;
  try {
    templateData.header.qrDataUrl = await computeDocumentQrDataUrl(documentData.header, {
      qrcode: _require('qrcode'),
    });
  } catch (e) {
    console.warn('[render] QR generation failed:', e.message);
  }
}

function renderTemplateWithHelpers(helpersCode, templateContent, templateData) {
  const Handlebars = _require('handlebars');
  registerReportHelpers(Handlebars, helpersCode);
  return Handlebars.compile(templateContent)(templateData);
}

describe('report server render path (ETP-4908 regression guards)', () => {
  it('renders a document template with a precomputed QR data URL and no throw', async () => {
    const documentData = { header: SAMPLE_HEADER, lines: SAMPLE_LINES, taxes: [] };
    const templateData = { css: '', header: { ...SAMPLE_HEADER }, lines: SAMPLE_LINES };

    await injectDocumentQr(documentData, templateData);

    let html;
    assert.doesNotThrow(() => {
      html = renderTemplateWithHelpers('', DOCUMENT_TEMPLATE, templateData);
    });

    assert.match(html, /data:image\/png;base64,/);
    assert.match(html, /INV-1001/);
    // formatDate / formatCurrency / formatNumber / ifCond all ran successfully.
    // formatDate resolves in the host's local timezone, so only the shape
    // (dd/mm/yyyy) is asserted here, not the exact day.
    assert.match(html, /\d{2}\/\d{2}\/2026/);
    // formatCurrency is the canonical es-ES grouped format (ETP-4314 sync).
    // CLDR quirk: some ICU builds skip the separator for 4-digit es-ES numbers.
    assert.match(html, /1\.?210,00/);
    assert.match(html, /Completed/);
    assert.match(html, /10,50/); // line unitPrice via formatCurrency
    assert.match(html, /189,50/);
  });

  it('throws "Missing helper" for a template invoking an unregistered helper', () => {
    // Documents the failure mode ETP-4908 fixed: any report-specific helper
    // (like the old per-report `qrCode`) that is not part of the canonical
    // whitelist below breaks the render instead of silently degrading.
    const templateData = { header: { documentno: 'INV-2002' } };
    assert.throws(
      () => renderTemplateWithHelpers('', UNREGISTERED_HELPER_TEMPLATE, templateData),
      /Missing helper: "qrCode"/,
    );
  });
});

describe('registerReportHelpers whitelist stability contract', () => {
  // Any future removal/rename of a name in this list is a silent production
  // "Missing helper" for every deployed template that still invokes it —
  // check the functional repo's artifacts/*/generated templates and
  // artifacts/*/helpers.js FIRST before changing this list.
  const EXPECTED_HELPER_NAMES = [
    'eq',
    'formatBoolean',
    'formatCurrency',
    'formatDate',
    'formatDateDisplay',
    'formatNumber',
    'ifCond',
    'isGroupBreak',
    'resetGroupTracking',
    'sumField',
    'sumRowsByCategory',
    'translateDocType',
  ].sort();

  it('registers exactly the documented canonical helper set', () => {
    const Handlebars = _require('handlebars');
    const registered = registerReportHelpers(Handlebars, '');
    assert.deepEqual(Object.keys(registered).sort(), EXPECTED_HELPER_NAMES);
  });
});

/**
 * Regression guards for ETP-5013 — the `{{> document-branding}}` production
 * bug this session found in server.js.
 *
 * `{{> document-branding}}` is NOT a native Handlebars partial reference (no
 * `Handlebars.registerPartial` call ever ran for it, on purpose — see
 * server.js's own comment on `expandReportPartials`). It is expanded via a
 * plain string replace BEFORE `Handlebars.compile()` runs. Verified here with
 * the REAL Handlebars compiler (not a mock): compiling the raw,
 * un-expanded `{{> document-branding}}` text throws
 * "The partial document-branding could not be found" — it does NOT render
 * blank — which is exactly the exception every print-* document threw in
 * production before this fix, because server.js never expanded the partial
 * (only the functional repo's Vite dev plugin, report-api.js, ever did).
 */
describe('document-branding partial expansion (ETP-5013 regression)', () => {
  // Replicated from server.js (see docstring at the top of this file for why
  // server.js itself is not imported directly — it starts an HTTP listener on
  // import). This is byte-identical to server.js's own expandReportPartials.
  function expandReportPartials(templateContent) {
    return templateContent.replace(/\{\{>\s*document-branding\s*\}\}/g, DOCUMENT_BRANDING_PARTIAL);
  }

  it('throws "The partial document-branding could not be found" when compiled WITHOUT expansion', () => {
    // This is the exact bug: server.js used to pass templateContent straight
    // from readFileSync() into Handlebars.compile(), skipping expansion
    // entirely, for every print-* document.
    assert.throws(
      () => renderTemplateWithHelpers('', TEMPLATE_WITH_BRANDING_PARTIAL, { header: { documentno: 'INV-3003' } }),
      /The partial document-branding could not be found/,
    );
  });

  it('renders without throwing once the partial is expanded, and embeds the logo markup', () => {
    const expanded = expandReportPartials(TEMPLATE_WITH_BRANDING_PARTIAL);
    let html;
    assert.doesNotThrow(() => {
      html = renderTemplateWithHelpers('', expanded, {
        header: { documentno: 'INV-3003', org_name: 'Acme', companyLogoDataUrl: 'data:image/png;base64,AAA' },
      });
    });
    assert.match(html, /class="document-brand-logo"/);
    assert.match(html, /data:image\/png;base64,AAA/);
  });

  it('leaves a template with no {{> document-branding}} reference completely unchanged', () => {
    assert.equal(expandReportPartials(DOCUMENT_TEMPLATE), DOCUMENT_TEMPLATE);
  });

  describe('server.js source', () => {
    const serverSource = readFileSync(join(__dirname, '..', 'server.js'), 'utf8');

    it('imports hydrateDocumentBranding and resolveCompanyLogoDataUrl from the shared module', () => {
      assert.match(serverSource, /import \{ hydrateDocumentBranding, resolveCompanyLogoDataUrl \} from '\.\.\/\.\.\/cli\/src\/report-branding\.js'/);
    });

    it('defines expandReportPartials and applies it before compiling/sending to jsreport', () => {
      assert.match(serverSource, /function expandReportPartials\(templateContent\)/);
      assert.match(serverSource, /templateContent\s*=\s*expandReportPartials\(readFileSync\(/,
        'templateContent must be run through expandReportPartials — this is the exact line that was missing');
    });

    it('runs hydrateDocumentBranding on the document-report header before it reaches the template', () => {
      assert.match(serverSource, /const header = await hydrateDocumentBranding\(headerResult\.rows\[0\] \|\| \{\}/);
    });

    it('falls back to an org_logo_id subquery when the document header SQL does not already expose one', () => {
      assert.match(serverSource, /headerSql\.includes\('org_logo_id'\)/);
      assert.match(serverSource, /FROM ad_orginfo oi WHERE oi\.ad_org_id = org\.ad_org_id/);
    });

    it('resolves companyLogoDataUrl for listing reports via the shared resolveCompanyLogoDataUrl helper', () => {
      // The listing branch (SQL/Jasper path) delegates the whole two-step
      // orgId → client-fallback lookup to the shared module instead of
      // re-querying ad_orginfo inline — see report-branding.js's own
      // resolveCompanyLogoDataUrl for the actual SQL and fallback logic.
      assert.match(
        serverSource,
        /const companyLogoDataUrl = await resolveCompanyLogoDataUrl\(pool, \{\s*\n\s*clientId, orgId: params\.orgId, authToken,/,
      );
    });

    it('carries companyLogoDataUrl from fetchReportData through renderReport into the listing meta', () => {
      assert.match(serverSource, /const \{ contract, documentData, neoMeta = \{\}, companyLogoDataUrl \} = result/);
      assert.match(serverSource, /companyLogoDataUrl,\s*\.\.\.neoMeta \}/,
        'companyLogoDataUrl must reach buildTemplateData\'s listing-branch meta object');
    });

    it('never puts companyLogoDataUrl in the document-branch meta (documents carry it on header instead)', () => {
      const lines = serverSource.split('\n');
      const ifIndex = lines.findIndex((line) => line.trim() === 'if (documentData) {');
      assert.ok(ifIndex >= 0, 'could not locate buildTemplateData\'s "if (documentData)" branch');
      const returnLine = lines[ifIndex + 1];
      assert.match(returnLine, /^\s*return \{/, 'expected the document-branch return literal on the next line');
      assert.ok(!returnLine.includes('companyLogoDataUrl'));
    });
  });
});

describe('server.js no-eval guard (ETP-4083 invariant)', () => {
  const serverSource = readFileSync(join(__dirname, '..', 'server.js'), 'utf8');

  it('never dynamically compiles code with `new Function(`', () => {
    assert.doesNotMatch(serverSource, /new\s+Function\s*\(/);
  });

  it('never calls `eval(`', () => {
    assert.doesNotMatch(serverSource, /(?<![.\w])eval\s*\(/);
  });

  it('reads helpersCode from disk but never executes it directly', () => {
    // helpersCode must only be passed through as inert text (registerReportHelpers
    // reads it statically via extractNumberFormatOptions, or forwards it verbatim
    // to jsreport, which owns its own sandboxed execution) — never run in-process.
    assert.match(serverSource, /helpersCode\s*=\s*loadHelpersFromFile/);
    assert.doesNotMatch(serverSource, /new\s+Function\s*\(\s*helpersCode/);
    assert.doesNotMatch(serverSource, /eval\s*\(\s*helpersCode/);
  });
});

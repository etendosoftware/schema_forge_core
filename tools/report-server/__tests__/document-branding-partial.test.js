/**
 * ETP-5013 — templates/reports/document-branding.hbs (this repo's own copy).
 *
 * Generalized to serve TWO branches: `header.companyLogoDataUrl` (document
 * reports, print-*, resolved from the header SQL row) and
 * `meta.companyLogoDataUrl` (listing reports, resolved from `params.orgId` —
 * see server.js's fetchReportData). Before ETP-5013 this partial only ever
 * checked `header.companyLogoDataUrl`, which is why it silently rendered
 * nothing for every listing report even after they gained a company-logo
 * lookup — there was no `header` object for a listing report to read it
 * from.
 *
 * This file is a manually-kept-in-sync copy of the functional repo's
 * templates/reports/document-branding.hbs (see this file's own leading
 * comment) — the same duplication pattern as base.css /
 * helpers/report-html-helpers.js in this directory. Both copies get their
 * own identical test coverage; do not delete one in favor of the other.
 */
import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const _require = createRequire(import.meta.url);

const PARTIAL = readFileSync(
  join(__dirname, '..', '..', '..', 'templates', 'reports', 'document-branding.hbs'),
  'utf8',
);

function renderPartial(data) {
  const Handlebars = _require('handlebars');
  return Handlebars.compile(PARTIAL)(data);
}

describe('templates/reports/document-branding.hbs (core copy)', () => {
  it('renders the header logo when header.companyLogoDataUrl is set', () => {
    const html = renderPartial({ header: { companyLogoDataUrl: 'data:image/png;base64,HEADER', org_name: 'Acme' } });
    assert.match(html, /<img/);
    assert.match(html, /src="data:image\/png;base64,HEADER"/);
    assert.match(html, /alt="Acme"/);
    assert.match(html, /class="document-brand-logo"/);
  });

  it('falls back to the listing logo when only meta.companyLogoDataUrl is set', () => {
    const html = renderPartial({ meta: { companyLogoDataUrl: 'data:image/png;base64,LISTING', title: 'Balance Sheet' } });
    assert.match(html, /<img/);
    assert.match(html, /src="data:image\/png;base64,LISTING"/);
    assert.match(html, /alt="Balance Sheet"/);
  });

  it('prefers header.companyLogoDataUrl over meta.companyLogoDataUrl when both are present', () => {
    const html = renderPartial({
      header: { companyLogoDataUrl: 'data:image/png;base64,HEADER', org_name: 'Acme' },
      meta: { companyLogoDataUrl: 'data:image/png;base64,LISTING', title: 'Balance Sheet' },
    });
    assert.match(html, /src="data:image\/png;base64,HEADER"/);
    assert.ok(!html.includes('LISTING'), 'the listing logo must not render when the document header already has one');
  });

  it('renders no <img> at all when neither header nor meta carries a logo', () => {
    assert.ok(!renderPartial({}).includes('<img'));
    assert.ok(!renderPartial({ header: {}, meta: {} }).includes('<img'));
  });
});

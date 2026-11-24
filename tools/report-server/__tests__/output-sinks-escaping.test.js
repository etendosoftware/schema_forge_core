/**
 * ETP-4561 — characterization: Handlebars double-stash escapes untrusted report
 * data in text and attribute contexts (document-branding.hbs interpolates
 * org_name / title into `alt="..."`). Regression coverage, no production change.
 * Known boundary: `{{{ }}}` is raw by design — only for trusted values (css).
 * `src="{{...DataUrl}}"` is produced server-side from DB logo bytes, not from user URLs.
 */
import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const Handlebars = createRequire(import.meta.url)('handlebars');
const PARTIAL = readFileSync(
  join(__dirname, '..', '..', '..', 'templates', 'reports', 'document-branding.hbs'),
  'utf8',
);
const render = (data) => Handlebars.compile(PARTIAL)(data);

describe('report template output encoding (ETP-4561)', () => {
  it('escapes an attribute-breaking org_name', () => {
    const html = render({ header: { companyLogoDataUrl: 'data:image/png;base64,AA==', org_name: '"><script>alert(1)</script>' } });
    assert.ok(!html.includes('<script>'));
    assert.ok(html.includes('alt="&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;"'));
  });
  it('escapes event-handler payloads in meta.title', () => {
    const html = render({ meta: { companyLogoDataUrl: 'data:image/png;base64,AA==', title: '" onerror="alert(1)' } });
    assert.ok(!/alt="[^"]*" onerror=/.test(html));
    assert.ok(html.includes('&quot; onerror&#x3D;&quot;alert(1)'));
  });
  it('keeps apostrophes in legitimate names readable and safe', () => {
    const html = render({ header: { companyLogoDataUrl: 'x', org_name: "O'Brien & Sons" } });
    assert.ok(html.includes('O&#x27;Brien &amp; Sons'));
  });
  it('does not double-decode encoded payloads', () => {
    const html = render({ header: { companyLogoDataUrl: 'x', org_name: '&lt;script&gt;' } });
    assert.ok(html.includes('&amp;lt;script&amp;gt;'));
  });
  it('HTML inside JSON data stays text', () => {
    const html = render({ header: { companyLogoDataUrl: 'x', org_name: JSON.parse('{"a":"<img src=x onerror=alert(1)>"}').a } });
    assert.ok(!html.includes('<img src=x'));
  });
});

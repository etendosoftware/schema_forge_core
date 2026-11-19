/**
 * ETP-5384 — encode-on-output guardrail (ADR-0005 in com.etendoerp.go).
 *
 * `templates/reports/*.hbs` and the templates the generator emits must never output stored free text
 * raw: only `{{{css}}}` (also `{{{~css~}}}`) may be triple-stashed. `{{& x}}` and `{{{{raw}}}}`
 * blocks are rejected, and no helper may use Handlebars `SafeString`. The rules are proven against
 * bad in-test fixtures so the guardrail cannot pass vacuously. CSV/Excel templates are exempt
 * (ADR-0004 `csvField`).
 */
import { describe, it } from 'node:test';
import Handlebars from 'handlebars';
import { strict as assert } from 'node:assert';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateTemplate } from '../src/generate-report-template.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

// {{{{raw}}}} blocks are rejected outright: their body is emitted unescaped. Matched first so the
// inner {{{ }}} are not reported twice.
const COMMENTS = /\{\{!--[\s\S]*?--\}\}|\{\{![\s\S]*?\}\}/g;
const RAW_BLOCK = /\{\{\{\{[\s\S]*?\}\}\}\}/g;
const RAW_OUTPUT = /\{\{\{([^}]*)\}\}\}|\{\{~?&([^}]*)\}\}/g;

function findRawOutputs(source) {
  const src = source.replace(COMMENTS, '');
  const found = [...src.matchAll(RAW_BLOCK)].map((m) => m[0]);
  const rest = src.replace(RAW_BLOCK, '');
  for (const m of rest.matchAll(RAW_OUTPUT)) {
    const expr = (m[1] ?? m[2] ?? '').replace(/~/g, '').trim();
    if (m[1] !== undefined && expr === 'css') continue;
    found.push(m[0]);
  }
  return found;
}

const usesSafeString = (source) => /SafeString/.test(source);

const SKIP_DIRS = new Set(['node_modules', '.git', 'build', 'dist']);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const isTestFile = (f) => /(^|\/)(__tests__|test|tests)\//.test(relative(ROOT, f))
  || /\.test\.[cm]?jsx?$/.test(f);

const allFiles = walk(ROOT);
const htmlTemplates = allFiles.filter(
  (f) => f.endsWith('.hbs') && !/-(csv|excel)\.hbs$/.test(f));
const sourceFiles = allFiles.filter((f) => /\.[cm]?jsx?$/.test(f) && !isTestFile(f));

describe('ETP-5384 encode-on-output: rule self-check', () => {
  for (const bad of [
    '{{{description}}}',
    '{{& description}}',
    '{{{~ description ~}}}',
    '{{~& description}}',
    '{{{{raw}}}} {{description}} {{{{/raw}}}}',
    '{{{css}}}{{{description}}}',
  ]) {
    it(`reports ${JSON.stringify(bad)}`, () => {
      assert.ok(findRawOutputs(bad).length > 0);
    });
  }

  it('accepts the allowed forms', () => {
    for (const ok of ['{{{css}}}', '{{{~css~}}}', '{{ description }}', '{{!-- {{{x}}} --}}']) {
      assert.deepEqual(findRawOutputs(ok), [], ok);
    }
  });

  it('detects SafeString by new, import, alias and bracket access', () => {
    for (const bad of [
      'new Handlebars.SafeString(x)',
      "import { SafeString } from 'handlebars'",
      'const S = Handlebars.SafeString; S(x)',
      "Handlebars['SafeString'](x)",
    ]) {
      assert.ok(usesSafeString(bad), bad);
    }
  });
});

describe('ETP-5384 encode-on-output', () => {
  it('finds the checked-in templates', () => {
    assert.ok(htmlTemplates.some((f) => f.endsWith('base-listing.hbs')));
  });

  it('checked-in HTML templates only emit raw output for {{{css}}}', () => {
    const offenders = [];
    for (const f of htmlTemplates) {
      for (const raw of findRawOutputs(readFileSync(f, 'utf8'))) {
        offenders.push(`${relative(ROOT, f)}: ${raw}`);
      }
    }
    assert.deepEqual(offenders, []);
  });

  it('templates produced by the generator only emit raw output for {{{css}}}', () => {
    const columns = [
      { field: 'documentNo', label: { en_US: 'Document No' }, type: 'string' },
      { field: 'amount', label: { en_US: 'Amount' }, type: 'amount' },
      { field: 'orderDate', label: { en_US: 'Date' }, type: 'date' },
      { field: 'qty', label: { en_US: 'Quantity' }, type: 'number' },
      { field: 'isActive', label: { en_US: 'Active' }, type: 'boolean' },
    ];
    const listing = { reportId: 'R001', type: 'listing', title: { en_US: 'T' }, columns };
    const grouped = {
      reportId: 'R002', type: 'grouped-listing', title: { en_US: 'G' }, columns,
      groups: [{ field: 'businessPartner', label: { en_US: 'Business Partner' } }],
    };
    for (const contract of [listing, grouped]) {
      const { template } = generateTemplate(contract);
      assert.ok(template.includes('{{{css}}}'));
      assert.deepEqual(findRawOutputs(template), [], contract.type);
    }
  });

  it('no helper uses Handlebars SafeString', () => {
    assert.ok(sourceFiles.length > 0);
    const offenders = sourceFiles.filter((f) => usesSafeString(readFileSync(f, 'utf8')))
      .map((f) => relative(ROOT, f));
    assert.deepEqual(offenders, []);
  });
});

// JavaScript column of docs/security/html-encoding-fixtures.md (com.etendoerp.go): what `{{ }}`
// emits. Java spells some entities differently; see the doc.
const HTML_FIXTURES = [
  ['<script>alert(document.cookie)</script>', '&lt;script&gt;alert(document.cookie)&lt;/script&gt;'],
  ['<img src=x onerror=alert(1)>', '&lt;img src&#x3D;x onerror&#x3D;alert(1)&gt;'],
  ['Tom & Jerry', 'Tom &amp; Jerry'],
  ['" onmouseover="x', '&quot; onmouseover&#x3D;&quot;x'],
  ["' onmouseover='x", '&#x27; onmouseover&#x3D;&#x27;x'],
  ['&lt;', '&amp;lt;'],
  ['x onmouseover=alert(1)>', 'x onmouseover&#x3D;alert(1)&gt;'],
  ['Normal Value', 'Normal Value'],
  ['', ''],
  [null, ''],
];

describe('ETP-5384 encode-on-output: Handlebars fixtures', () => {
  it('escapeExpression matches the JavaScript column of the fixtures doc', () => {
    for (const [input, expected] of HTML_FIXTURES) {
      assert.equal(Handlebars.escapeExpression(input), expected, String(input));
    }
  });

  it('{{ }} renders stored markup inert', () => {
    const html = Handlebars.compile('<td>{{description}}</td>')({
      description: '<script>alert(document.cookie)</script>',
    });
    assert.equal(html, '<td>&lt;script&gt;alert(document.cookie)&lt;/script&gt;</td>');
  });
});

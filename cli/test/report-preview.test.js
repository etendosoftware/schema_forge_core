import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildJsreportPayload,
  resolveTemplateFiles,
  parsePreviewArgs,
} from '../src/report-preview.js';

function sampleContract() {
  return {
    version: 1,
    reportId: 'business-partner-listing',
    type: 'listing',
    entity: 'business-partner',
    title: { en_US: 'Business Partners', es_ES: 'Terceros' },
    outputs: ['pdf'],
    columns: [
      { field: 'searchKey', label: { en_US: 'Search Key', es_ES: 'Clave' }, type: 'string', width: '10%', sortable: true },
      { field: 'name', label: { en_US: 'Name', es_ES: 'Nombre' }, type: 'string', width: '25%', sortable: true },
    ],
    filters: [],
    defaultSort: { field: 'name', direction: 'asc' },
    summary: { totalRows: true },
  };
}

function sampleMockData() {
  return [
    { searchKey: 'BP001', name: 'Empresa Demo S.L.' },
    { searchKey: 'BP002', name: 'Test Corp' },
  ];
}

describe('parsePreviewArgs', () => {
  it('parses artifact and report flags', () => {
    const opts = parsePreviewArgs(['--artifact', 'business-partner', '--report', 'listing']);
    assert.equal(opts.artifact, 'business-partner');
    assert.equal(opts.report, 'listing');
  });

  it('defaults format to pdf', () => {
    const opts = parsePreviewArgs(['--artifact', 'bp', '--report', 'listing']);
    assert.equal(opts.format, 'pdf');
  });

  it('parses --format flag', () => {
    const opts = parsePreviewArgs(['--artifact', 'bp', '--report', 'listing', '--format', 'xlsx']);
    assert.equal(opts.format, 'xlsx');
  });

  it('parses --locale flag', () => {
    const opts = parsePreviewArgs(['--artifact', 'bp', '--report', 'listing', '--locale', 'es_ES']);
    assert.equal(opts.locale, 'es_ES');
  });
});

describe('buildJsreportPayload', () => {
  it('builds valid jsreport API payload', () => {
    const payload = buildJsreportPayload(sampleContract(), sampleMockData(), {
      locale: 'en_US',
      css: 'body { color: black; }',
      templateContent: '<html>{{meta.title}}</html>',
    });

    assert.equal(payload.template.engine, 'handlebars');
    assert.equal(payload.template.recipe, 'chrome-pdf');
    assert.ok(payload.template.content.includes('{{meta.title}}'));
    assert.equal(payload.data.meta.title, 'Business Partners');
    assert.equal(payload.data.meta.locale, 'en_US');
    assert.equal(payload.data.rows.length, 2);
    assert.equal(payload.data.columns.length, 2);
    assert.equal(payload.data.columns[0].label, 'Search Key');
  });

  it('resolves i18n labels for es_ES', () => {
    const payload = buildJsreportPayload(sampleContract(), sampleMockData(), {
      locale: 'es_ES',
      css: '',
      templateContent: '',
    });

    assert.equal(payload.data.meta.title, 'Terceros');
    assert.equal(payload.data.columns[0].label, 'Clave');
  });

  it('includes CSS in data', () => {
    const payload = buildJsreportPayload(sampleContract(), sampleMockData(), {
      locale: 'en_US',
      css: '.report { color: red; }',
      templateContent: '',
    });
    assert.equal(payload.data.css, '.report { color: red; }');
  });

  it('includes summary with totalRows', () => {
    const payload = buildJsreportPayload(sampleContract(), sampleMockData(), {
      locale: 'en_US', css: '', templateContent: '',
    });
    assert.equal(payload.data.summary.totalRows, 2);
  });
});

describe('resolveTemplateFiles', () => {
  it('returns expected file paths', () => {
    const files = resolveTemplateFiles('/root', 'business-partner', 'listing');
    assert.ok(files.template.endsWith('template.hbs'));
    assert.ok(files.css.endsWith('base.css'));
    assert.ok(files.mockData.endsWith('mockData.js'));
    assert.ok(files.overrideCss.endsWith('style.css'));
  });
});

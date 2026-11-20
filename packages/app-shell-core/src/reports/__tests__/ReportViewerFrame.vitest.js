// @covers packages/app-shell-core/src/reports/ReportViewerFrame.jsx
// ETP-4561 — characterization of the <iframe src> built from report descriptors.
// Callers: runtime/AppShellRuntime.jsx passes baseUrl/params from createReportDescriptor
// (app-author config, not end-user input). These tests prove reportId/params cannot change
// the scheme, host or path of the final URL.
import { describe, it, expect } from 'vitest';
import { buildReportUrl } from '../ReportViewerFrame.jsx';

const BASE = 'https://app.example.com';

describe('buildReportUrl', () => {
  it('builds the expected report URL', () => {
    expect(buildReportUrl({ baseUrl: BASE, reportId: 'sales', params: { a: '1' }, format: 'pdf' }))
      .toBe('https://app.example.com/sws/reports/sales?format=pdf&a=1');
  });
  for (const reportId of ['../../admin', 'x?y=1', 'javascript:alert(1)', '"onload="x', '//evil.example', 'a/b']) {
    it(`encodes reportId ${JSON.stringify(reportId)} into a single path segment`, () => {
      const url = new URL(buildReportUrl({ baseUrl: BASE, reportId }));
      expect(url.origin).toBe(BASE);
      expect(url.pathname.startsWith('/sws/reports/')).toBeTruthy();
      expect(url.pathname.split('/').length).toBe(4);
      expect(url.searchParams.get('format')).toBe('pdf');
    });
  }
  it('keeps hostile param keys and values inside the query string', () => {
    const url = new URL(buildReportUrl({
      baseUrl: BASE,
      reportId: 'r',
      params: { 'a&format': 'html', q: "x'&format=html#y", s: 'javascript:alert(1)' },
    }));
    expect(url.origin).toBe(BASE);
    expect(url.searchParams.get('format')).toBe('pdf');
    expect(url.searchParams.get('q')).toBe("x'&format=html#y");
    expect(url.hash).toBe('');
  });
  it('only baseUrl can change the origin (trusted app config)', () => {
    expect(new URL(buildReportUrl({ baseUrl: 'https://reports.example', reportId: 'r' })).origin).toBe('https://reports.example');
  });
});

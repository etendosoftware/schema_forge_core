// @covers packages/app-shell-core/src/lib/safeUrl.js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseSafeUrl, isSafeUrl } from '../safeUrl.js';

describe('parseSafeUrl — rejected', () => {
  const bad = [
    'javascript:alert(1)',
    'JaVaScRiPt:alert(1)',
    '  javascript:alert(1)',
    '\n\tjavascript:alert(1)',
    'java\tscript:alert(1)',
    'java\nscript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'DATA:text/html;base64,PHNjcmlwdD4=',
    'vbscript:msgbox(1)',
    'about:blank',
    'filesystem:https://example.com/temporary/x',
    'file:///etc/passwd',
    'blob:https://a.example/uuid',
    'https://user:pw@example.com/',
    'https://user@example.com/',
    'https://exa mple.com/',
    'https://',
    'http://[::1',
    'ftp://example.com/',
    'javascript%3Aalert(1)',
    '&#106;avascript:alert(1)',
    '//evil.example/x',
    '/\\evil.example',
    'example.com/path',
    '',
    '   ',
    null,
    undefined,
    42,
    {},
  ];
  for (const input of bad) {
    it(`rejects ${JSON.stringify(input)}`, () => assert.equal(parseSafeUrl(input), null));
  }
  it('rejects relative paths unless allowed', () => assert.equal(parseSafeUrl('/a/b'), null));
  it('rejects http when only https is allowed', () => assert.equal(parseSafeUrl('http://example.com'), null));
  it('still rejects dangerous schemes with allowCustomSchemes', () => {
    for (const u of ['about:blank', 'filesystem:https://a.example/t/x', 'javascript:alert(1)', 'data:text/html,x', 'file:///x', 'vbscript:x']) {
      assert.equal(parseSafeUrl(u, { allowCustomSchemes: true }), null);
    }
  });
  it('rejects protocol-relative even with allowRelative', () => {
    assert.equal(parseSafeUrl('//evil.example', { allowRelative: true }), null);
    assert.equal(parseSafeUrl('/\\evil.example', { allowRelative: true }), null);
  });
});

describe('parseSafeUrl — accepted', () => {
  it('accepts a valid https URL and canonicalizes it', () => {
    assert.equal(parseSafeUrl('HTTPS://Example.COM/a?b=1#c'), 'https://example.com/a?b=1#c');
  });
  it('trims surrounding whitespace', () => {
    assert.equal(parseSafeUrl('  https://example.com/ '), 'https://example.com/');
  });
  it('accepts internationalized domains (punycode canonical form)', () => {
    assert.equal(parseSafeUrl('https://bücher.example/'), 'https://xn--bcher-kva.example/');
  });
  it('keeps quotes/apostrophes in query data (percent-encoded by the parser)', () => {
    assert.equal(parseSafeUrl("https://example.com/?n=O'Neil"), 'https://example.com/?n=O%27Neil');
  });
  it('accepts http when listed', () => {
    assert.ok(isSafeUrl('http://localhost:3000/cb', { allowedProtocols: ['http:', 'https:'] }));
  });
  it('accepts app deep links only with allowCustomSchemes', () => {
    assert.equal(parseSafeUrl('cursor://anysphere.cursor-deeplink/mcp/install?name=x'), null);
    assert.ok(isSafeUrl('cursor://anysphere.cursor-deeplink/mcp/install?name=x', { allowCustomSchemes: true }));
  });
  it('accepts same-origin relative paths when allowed', () => {
    assert.equal(parseSafeUrl('/a/b?c=1#d', { allowRelative: true }), '/a/b?c=1#d');
  });
  it('accepts credentials only when explicitly allowed', () => {
    assert.ok(isSafeUrl('https://u:p@example.com/', { allowCredentials: true }));
  });
});

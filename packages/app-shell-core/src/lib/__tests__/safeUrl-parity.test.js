// @covers packages/app-shell-core/src/lib/safeUrl.js
// ETP-4561 — the output-sink URL policy must stay compatible with ETP-4556's declarative
// `allowedSchemes` constraint (lib/validation/constraints/schemes.js). Same table through both.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseSafeUrl } from '../safeUrl.js';
import { parseUrl, parseUrlScheme } from '../validation/formats.js';

// The validator's `allowedSchemes: ['https']` decision, as schemes.js makes it:
// parseable AND scheme in the allowlist.
const validatorAccepts = (value, allowed = ['https']) => parseUrl(value) !== null && allowed.includes(parseUrlScheme(value));

const SHARED = [
  'https://example.com/',
  'HTTPS://EXAMPLE.COM/',
  '  https://example.com/  ',
  '\thttps://example.com/\n',
  'https://bücher.example/',
  'http://example.com/',
  'JaVaScRiPt:alert(1)',
  '  javascript:alert(1)',
  'java\tscript:alert(1)',
  'java\nscript:alert(1)',
  'data:text/html,x',
  'javascript%3Aalert(1)',
  '/relative/path',
  '//evil.example/x',
  'example.com',
  'https://exa mple.com/',
  'http://[::1',
  '',
];

describe('safeUrl parity with the ETP-4556 allowedSchemes validator', () => {
  for (const input of SHARED) {
    it(`agrees on ${JSON.stringify(input)} for allowedSchemes ['https']`, () => {
      assert.equal(parseSafeUrl(input) !== null, validatorAccepts(input));
    });
  }
  it('agrees when http is also allowed', () => {
    for (const input of SHARED) {
      assert.equal(
        parseSafeUrl(input, { allowedProtocols: ['https:', 'http:'] }) !== null,
        validatorAccepts(input, ['https', 'http']),
        input,
      );
    }
  });
});

describe('intentional differences (the sink is stricter)', () => {
  it('rejects embedded credentials; the validator ignores them and passes', () => {
    assert.equal(validatorAccepts('https://user:pw@example.com/'), true);
    assert.equal(parseSafeUrl('https://user:pw@example.com/'), null);
  });
  it('hard-blocks dangerous schemes even when a caller allows custom schemes', () => {
    assert.equal(parseSafeUrl('javascript:alert(1)', { allowCustomSchemes: true }), null);
  });
  it('treats relative URLs as opt-in and never accepts protocol-relative ones', () => {
    assert.equal(parseSafeUrl('/a', { allowRelative: true }), '/a');
    assert.equal(parseSafeUrl('//evil.example', { allowRelative: true }), null);
  });
});

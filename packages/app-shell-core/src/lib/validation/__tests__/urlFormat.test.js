import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validateRecord } from '../index.js';

const check = (site) => validateRecord({
  fields: [{ name: 'site', validation: { format: 'url' } }],
  values: { site },
}).valid;

describe('format: url requires a domain-shaped host (ETP-4557)', () => {
  it('rejects a single-label host', () => {
    assert.equal(check('https://asda'), false);
    assert.equal(check('https://localhost'), false);
  });
  it('accepts domains, with port, path, query and subdomains', () => {
    assert.equal(check('https://acme.com'), true);
    assert.equal(check('https://sub.acme.co.uk:8443/path?a=b#x'), true);
  });
  it('accepts an IPv4 literal and a punycode TLD', () => {
    assert.equal(check('https://192.168.0.1'), true);
    assert.equal(check('https://example.xn--p1ai'), true);
  });
  it('rejects a numeric TLD, a bad label and non-hierarchical URLs', () => {
    assert.equal(check('https://acme.123'), false);
    assert.equal(check('https://-bad-.com'), false);
    assert.equal(check('mailto:someone@acme.com'), false);
    assert.equal(check('not a url'), false);
  });
});

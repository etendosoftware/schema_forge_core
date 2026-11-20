import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { attributionPageUri, readCookie, readHubSpotContext } from '../src/onboarding/hubspotAttribution.js';

/**
 * ETP-6363 — the lead attribution a sign-up sends: HubSpot's visitor cookie and the page, never
 * anything else from the address.
 *
 * @covers schema_forge_core/packages/etendo-go-core/src/onboarding/hubspotAttribution.js
 */
const HUTK = '0123456789abcdef0123456789abcdef';

describe('readCookie', () => {
  it('finds a cookie among others and decodes it', () => {
    assert.equal(readCookie(`a=1; hubspotutk=${HUTK}; b=x%20y`, 'hubspotutk'), HUTK);
    assert.equal(readCookie('a=1; b=x%20y', 'b'), 'x y');
  });

  it('answers null for a missing, empty or undecodable cookie', () => {
    assert.equal(readCookie('a=1', 'hubspotutk'), null);
    assert.equal(readCookie('', 'hubspotutk'), null);
    assert.equal(readCookie(undefined, 'hubspotutk'), null);
    assert.equal(readCookie('hubspotutk=%E0%A4%A', 'hubspotutk'), null);
  });

  it('does not take a cookie whose name only ends like the one asked', () => {
    assert.equal(readCookie(`xhubspotutk=${HUTK}`, 'hubspotutk'), null);
  });
});

describe('attributionPageUri', () => {
  it('keeps the campaign parameters HubSpot attributes the lead to', () => {
    assert.equal(
      attributionPageUri('https://app.etendo.ai/onboarding?utm_source=google&utm_campaign=x&gclid=abc&hsa_ad=1'),
      'https://app.etendo.ai/onboarding?utm_source=google&utm_campaign=x&gclid=abc&hsa_ad=1');
  });

  it('drops every other parameter and the fragment, so no token leaves the app', () => {
    assert.equal(
      attributionPageUri('https://app.etendo.ai/onboarding?token=secret&invite=1&utm_medium=cpc#step'),
      'https://app.etendo.ai/onboarding?utm_medium=cpc');
    assert.equal(attributionPageUri('https://app.etendo.ai/login?token=secret'), 'https://app.etendo.ai/login');
  });

  it('refuses an address that is not a web page', () => {
    assert.equal(attributionPageUri('not a url'), null);
    assert.equal(attributionPageUri('javascript:alert(1)'), null);
  });
});

describe('readHubSpotContext', () => {
  it('sends the visitor cookie, the page and its title', () => {
    assert.deepEqual(readHubSpotContext({
      cookie: `hubspotutk=${HUTK.toUpperCase()}`,
      href: 'https://app.etendo.ai/onboarding?utm_source=linkedin&email=ana@example.com',
      title: '  Etendo GO  ',
    }), {
      hutk: HUTK,
      pageUri: 'https://app.etendo.ai/onboarding?utm_source=linkedin',
      pageName: 'Etendo GO',
    });
  });

  it('leaves the cookie out when the visitor refused it or it is not HubSpot\'s', () => {
    assert.deepEqual(readHubSpotContext({ cookie: '', href: 'https://app.etendo.ai/', title: '' }),
      { pageUri: 'https://app.etendo.ai/' });
    assert.deepEqual(readHubSpotContext({ cookie: 'hubspotutk=not-a-token', href: '', title: '' }), null);
  });

  it('sends nothing outside a browser', () => {
    assert.equal(readHubSpotContext(), null);
  });
});

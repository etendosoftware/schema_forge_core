import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createApiFetch, resetApiSessionForTests, resetRecordWriteChainsForTests } from '../api.js';
import { resetSessionCredentials, setSessionCredentials } from '../sessionCredentials.js';
import { resetRecordVersionsForTests } from '../../lib/recordVersions.js';
import {
  FEATURE_HEADER, buildFeatureKey, clearActiveFeature, featureRequestHeaders, getActiveFeature,
  isValidFeatureKey, setActiveFeature,
} from '../featureContext.js';

/**
 * ETP-5646 — the bounded feature context on first-party NEO requests: key shape, injection
 * through the shared authenticated request path, trusted URLs, tabs/concurrency and identity
 * switch / logout.
 */
const originalFetch = globalThis.fetch;
let sent;

function stubFetch() {
  sent = [];
  globalThis.fetch = async (url, init) => {
    sent.push({ url, headers: init?.headers || {} });
    return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
  };
}

const client = (base = '/etendo') => createApiFetch(base, () => null, () => {});

beforeEach(() => {
  resetRecordWriteChainsForTests();
  resetRecordVersionsForTests();
  resetApiSessionForTests();
  resetSessionCredentials();
  clearActiveFeature();
  stubFetch();
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  clearActiveFeature();
  resetSessionCredentials();
});

describe('feature keys', () => {
  it('accepts the four kinds and rejects anything unbounded or malformed', () => {
    for (const key of ['window.sales-order', 'process.not-posted-documents', 'report.tax-report', 'custom.invoice-inbox']) {
      assert.equal(isValidFeatureKey(key), true, key);
    }
    for (const key of ['', 'window.', 'window.Sales', 'menu.x', 'window.a b', 'window.x\r\nX-Evil: 1',
      `window.${'a'.repeat(64)}`, null, undefined, 42, 'window.sales_order']) {
      assert.equal(isValidFeatureKey(key), false, String(key));
    }
  });

  it('builds a key from a menu name and refuses an unknown kind or an empty slug', () => {
    assert.equal(buildFeatureKey('window', 'Sales Order'), 'window.sales-order');
    assert.equal(buildFeatureKey('report', 'tax-report'), 'report.tax-report');
    assert.equal(buildFeatureKey('page', 'x'), null);
    assert.equal(buildFeatureKey('window', '###'), null);
  });
});

describe('request header', () => {
  it('sends the active feature on a first-party request, and nothing without one', async () => {
    await client()('/sws/go/x');
    assert.equal(sent[0].headers[FEATURE_HEADER], undefined);
    setActiveFeature('window.sales-order');
    await client()('/sws/go/x');
    assert.equal(sent[1].headers[FEATURE_HEADER], 'window.sales-order');
  });

  it('lets the explicit `feature` option win and drops an invalid one instead of repairing it', async () => {
    setActiveFeature('window.sales-order');
    await client()('/sws/go/x', { feature: 'process.confirm-order' });
    await client()('/sws/go/x', { feature: 'Not Valid' });
    assert.equal(sent[0].headers[FEATURE_HEADER], 'process.confirm-order');
    assert.equal(sent[1].headers[FEATURE_HEADER], undefined);
  });

  it('never sends it to a third-party URL', async () => {
    setActiveFeature('window.sales-order');
    await client('')('https://third.example/api');
    await client('')('//third.example/api');
    assert.equal(sent[0].headers[FEATURE_HEADER], undefined);
    assert.equal(sent[1].headers[FEATURE_HEADER], undefined);
  });

  it('sends it to the configured absolute base and not to another origin', async () => {
    setActiveFeature('window.sales-order');
    await client('https://api.etendo.example')('/sws/go/x');
    await client('https://api.etendo.example')('https://other.example/x');
    assert.equal(sent[0].headers[FEATURE_HEADER], 'window.sales-order');
    assert.equal(sent[1].headers[FEATURE_HEADER], undefined);
  });

  it('is read per dispatch: concurrent requests each carry the feature set when they leave', async () => {
    const api = client();
    setActiveFeature('window.a');
    const first = api('/sws/go/a');
    setActiveFeature('window.b');
    const second = api('/sws/go/b');
    await Promise.all([first, second]);
    const byUrl = Object.fromEntries(sent.map((s) => [s.url, s.headers[FEATURE_HEADER]]));
    assert.equal(byUrl['/etendo/sws/go/a'], 'window.a');
    assert.equal(byUrl['/etendo/sws/go/b'], 'window.b');
  });

  it('keeps the feature out of the way of the credential headers', async () => {
    setSessionCredentials({ mode: 'bearer', token: 'tkn' });
    setActiveFeature('window.sales-order');
    await client()('/sws/go/x');
    assert.equal(sent[0].headers.Authorization, 'Bearer tkn');
    assert.equal(sent[0].headers[FEATURE_HEADER], 'window.sales-order');
  });
});

describe('identity switch and logout', () => {
  it('does not label a request of another account with the previous account feature', async () => {
    setSessionCredentials({ mode: 'cookie', accountId: 'A' });
    setActiveFeature('window.sales-order', 'A');
    await client()('/sws/go/x');
    setSessionCredentials({ mode: 'cookie', accountId: 'B' });
    await client()('/sws/go/x');
    assert.equal(sent[0].headers[FEATURE_HEADER], 'window.sales-order');
    assert.equal(sent[1].headers[FEATURE_HEADER], undefined);
    assert.equal(getActiveFeature('B'), null);
  });

  it('a direct URL opened before the session binds is adopted by the account that binds next', async () => {
    setActiveFeature('window.sales-order');
    setSessionCredentials({ mode: 'cookie', accountId: 'A' });
    await client()('/sws/go/x');
    assert.equal(sent[0].headers[FEATURE_HEADER], 'window.sales-order');
  });

  it('does not send it once the session is gone', () => {
    setSessionCredentials({ mode: 'cookie', accountId: 'A' });
    setActiveFeature('window.sales-order', 'A');
    resetSessionCredentials();
    assert.deepEqual(featureRequestHeaders({ url: '/x', scope: null }), {});
  });

  it('an invalid key clears the feature rather than keeping the previous one', () => {
    setActiveFeature('window.sales-order');
    assert.equal(setActiveFeature('???'), null);
    assert.equal(getActiveFeature(), null);
  });
});

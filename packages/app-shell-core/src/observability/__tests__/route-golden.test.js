import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeRoute } from '../sanitize.js';

// ETP-4578 C6 (D5): continuity with what the host has been sending to Mixpanel.
//
// `host` is what the host's own normalizeRoute (tools/app-shell/src/lib/observability/payload.js)
// returned for the same input, MEASURED on 2026-09-29 and frozen here. The rule the core follows:
//
//  - where the host collapses a real id, the core gives the SAME placeholder, so a dashboard
//    grouped on the route pattern keeps its series;
//  - where the host collapses too much — a word such as `new` or `configuration-settings`, or
//    the `/go` base path itself — the core does NOT, and the row says `intentional`.
//
// A route as the router reports it has no base path (`/<screen>/<id>`, two segments);
// `window.location` carries it (`/go/<screen>/<id>`, three segments).
const TOKEN = 'tok-abcdef0123456789';
const HEX = 'a1b2c3d4e5f60718293a4b5c6d7e8f90';
const UPPER = '0123456789ABCDEF0123456789ABCDEF';

const GOLDEN = [
  // The invoice portal, with and without the base path.
  { input: `/portal/${TOKEN}`, host: '/portal/:recordId', core: '/portal/:recordId' },
  { input: `/go/portal/${TOKEN}`, host: '/go/portal/:id', core: '/go/portal/:id' },
  // A record's own page.
  { input: `/sales-order/${HEX}`, host: '/sales-order/:recordId', core: '/sales-order/:recordId' },
  { input: `/go/sales-order/${HEX}`, host: '/go/sales-order/:id', core: '/go/sales-order/:id' },
  { input: `/sales-order/${UPPER}`, host: '/sales-order/:recordId', core: '/sales-order/:recordId' },
  { input: '/sales-order/123', host: '/sales-order/:recordId', core: '/sales-order/:recordId' },
  { input: `/sales-order/${HEX}?tab=lines#x`, host: '/sales-order/:recordId', core: '/sales-order/:recordId' },
  { input: `/reset/${TOKEN}`, host: '/reset/:recordId', core: '/reset/:recordId' },
  { input: `/go/reset/${TOKEN}`, host: '/go/reset/:id', core: '/go/reset/:id' },
  // Three segments and more.
  { input: `/sales-order/${HEX}/lines`, host: '/sales-order/:id/lines', core: '/sales-order/:id/lines' },
  { input: `/go/sales-order/${HEX}/lines`, host: '/go/sales-order/:id/lines', core: '/go/sales-order/:id/lines' },
  // No id at all.
  { input: '/', host: '/', core: '/' },
  { input: '/go', host: '/go', core: '/go' },
  { input: '/sales-order', host: '/sales-order', core: '/sales-order' },
  { input: '/configuration-settings', host: '/configuration-settings', core: '/configuration-settings' },
  { input: '/artifacts/foo', host: '/artifacts/foo', core: '/artifacts/foo' },
  { input: '/go/sales-order/new', host: '/go/sales-order/new', core: '/go/sales-order/new' },
  // The host collapses too much here; the core does not (intentional).
  { input: '/sales-order/new', host: '/sales-order/:recordId', core: '/sales-order/new', intentional: 'a word is not an id' },
  { input: '/purchase-order-lines/configuration-settings', host: '/purchase-order-lines/:recordId', core: '/purchase-order-lines/configuration-settings', intentional: 'a word is not an id' },
  { input: '/go/purchase-order-lines/configuration-settings', host: '/go/:id/:id', core: '/go/purchase-order-lines/configuration-settings', intentional: 'a word is not an id' },
  { input: '/settings/organization/fiscal-configuration/new', host: '/settings/:id/:id/new', core: '/settings/organization/fiscal-configuration/new', intentional: 'a word is not an id' },
  { input: '/go/settings/organization/fiscal-configuration/new', host: '/go/settings/:id/:id/new', core: '/go/settings/organization/fiscal-configuration/new', intentional: 'a word is not an id' },
  { input: '/go/sales-order', host: '/go/:recordId', core: '/go/sales-order', intentional: 'the base path is not a screen' },
];

describe('normalizeRoute against the host\'s measured output (ETP-4578 D5)', () => {
  for (const { input, host, core, intentional } of GOLDEN) {
    it(`${input} -> ${core}${intentional ? ` (differs from the host: ${intentional})` : ''}`, () => {
      assert.equal(normalizeRoute(input), core);
      if (!intentional) assert.equal(core, host, 'a row without `intentional` must equal the host');
      else assert.notEqual(core, host);
    });
  }

  it('is stable when applied twice', () => {
    for (const { input } of GOLDEN) {
      const once = normalizeRoute(input);
      assert.equal(normalizeRoute(once), once, input);
    }
  });

  it('keeps `:id` for ids embedded in other strings: only a route is a record page', async () => {
    const { sanitizeValue } = await import('../sanitize.js');
    assert.equal(
      sanitizeValue({ url: `https://go.etendo.cloud/reset/${HEX}` }, { allowedKeys: ['url'] }).url,
      'https://go.etendo.cloud/reset/:id',
    );
  });
});

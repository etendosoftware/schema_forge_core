/**
 * Contract of the step route matcher (ETP-5144).
 *
 * A step's `route` decides whether the engine has to NAVIGATE before it can
 * look for the target. Get this wrong in either direction and the tour breaks
 * in a way that reads like a broken selector: too strict and every step
 * re-navigates to the screen it is already on (losing unsaved form state); too
 * loose and a step looks for its target on the wrong screen and reports
 * "target not found".
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { matchRoutePattern } from '../routeMatch.js';

describe('matchRoutePattern — exact segments', () => {
  it('matches an identical path', () => {
    assert.equal(matchRoutePattern('/contacts', '/contacts'), true);
  });

  it('treats a trailing slash as the same screen', () => {
    assert.equal(matchRoutePattern('/contacts', '/contacts/'), true);
    assert.equal(matchRoutePattern('/contacts/', '/contacts'), true);
  });

  it('supplies a missing leading slash on either side', () => {
    assert.equal(matchRoutePattern('contacts', '/contacts'), true);
    assert.equal(matchRoutePattern('/contacts', 'contacts'), true);
  });

  it('matches the root', () => {
    assert.equal(matchRoutePattern('/', '/'), true);
  });

  it('does not match a different screen', () => {
    assert.equal(matchRoutePattern('/contacts', '/products'), false);
  });

  it('does not match a PREFIX — a pattern is the whole path, not its start', () => {
    // Without this, a step authored for the list screen would consider itself
    // already on-screen while the browser sits on a record's detail view.
    assert.equal(matchRoutePattern('/contacts', '/contacts/42'), false);
    assert.equal(matchRoutePattern('/contacts/42', '/contacts'), false);
  });

  it('decodes a percent-encoded segment before comparing', () => {
    assert.equal(matchRoutePattern('/sales order', '/sales%20order'), true);
  });

  it('survives a malformed percent-encoding instead of throwing', () => {
    // `decodeURIComponent('%E0%A4%A')` throws; the matcher must answer, not
    // crash the overlay mid-tour.
    assert.doesNotThrow(() => matchRoutePattern('/x', '/%E0%A4%A'));
    assert.equal(matchRoutePattern('/x', '/%E0%A4%A'), false);
  });
});

describe('matchRoutePattern — :param', () => {
  it('consumes any non-empty segment', () => {
    assert.equal(matchRoutePattern('/sales-order/:recordId', '/sales-order/B6BDC5FC'), true);
    assert.equal(matchRoutePattern('/:windowName', '/purchase-order'), true);
  });

  it('does NOT match an empty segment', () => {
    // "/sales-order/" normalizes to "/sales-order", which has fewer segments —
    // a param must have something to bind to.
    assert.equal(matchRoutePattern('/sales-order/:recordId', '/sales-order/'), false);
  });

  it('still requires the same number of segments', () => {
    assert.equal(matchRoutePattern('/:windowName/:recordId', '/sales-order'), false);
    assert.equal(matchRoutePattern('/:windowName', '/sales-order/42'), false);
  });
});

describe('matchRoutePattern — wildcard', () => {
  it('swallows every remaining segment', () => {
    assert.equal(matchRoutePattern('/reports/*', '/reports'), true);
    assert.equal(matchRoutePattern('/reports/*', '/reports/aging/receivable'), true);
  });

  it('matches anything at the root', () => {
    assert.equal(matchRoutePattern('/*', '/anything/at/all'), true);
  });

  it('still honours the segments BEFORE it', () => {
    assert.equal(matchRoutePattern('/reports/*', '/contacts/aging'), false);
  });
});

describe('matchRoutePattern — nothing to match', () => {
  it('refuses a missing, empty or non-string pattern', () => {
    for (const pattern of [undefined, null, '', '   ', 42, {}]) {
      assert.equal(matchRoutePattern(pattern, '/contacts'), false);
    }
  });

  it('treats a missing pathname as the root', () => {
    assert.equal(matchRoutePattern('/', undefined), true);
    assert.equal(matchRoutePattern('/contacts', undefined), false);
  });
});

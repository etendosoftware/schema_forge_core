import { describe, it, beforeEach } from 'node:test';
import { strict as assert } from 'node:assert';

import {
  CREDENTIAL_MODES,
  credentialOptions,
  getCredentialMode,
  jsonHeaders,
  resetSessionCredentials,
  setSessionCredentials,
  writeHeaders,
} from '../sessionCredentials.js';

/**
 * sessionCredentials.js is the single decision point for how a request proves
 * who is making it, so every call site in the core and the host inherits
 * whatever it gets wrong. These are real behavioural assertions rather than
 * source-reading (the module touches no browser globals, so it imports cleanly
 * under `node --test`).
 *
 * The four quadrants that matter — each scheme with and without its credential —
 * plus the two properties that are load-bearing for the migration: the default
 * is bearer, and a read never carries a CSRF proof.
 */
describe('sessionCredentials', () => {
  beforeEach(() => {
    resetSessionCredentials();
  });

  describe('default state', () => {
    /**
     * The most important assertion in the file. The whole point of routing both
     * schemes through here is that an instance which has not opted in keeps
     * working; a flipped default silently migrates every host on a version bump,
     * which is precisely the incident this module exists to prevent.
     */
    it('starts in bearer mode, so an un-opted-in host is unaffected', () => {
      assert.equal(getCredentialMode(), CREDENTIAL_MODES.bearer);
    });

    it('carries no credential before any session is published', () => {
      assert.deepEqual(jsonHeaders(), { 'Content-Type': 'application/json' });
      assert.deepEqual(writeHeaders(), { 'Content-Type': 'application/json' });
    });
  });

  describe('bearer mode', () => {
    it('sends the Authorization header on reads and writes', () => {
      setSessionCredentials({ mode: CREDENTIAL_MODES.bearer, token: 'tok-1' });

      assert.equal(jsonHeaders().Authorization, 'Bearer tok-1');
      assert.equal(writeHeaders().Authorization, 'Bearer tok-1');
    });

    /**
     * Without this guard a missing token interpolates into the literal string
     * "Bearer undefined", which the backend rejects with a 401 that reads as a
     * server fault rather than a missing credential. Omitting the header instead
     * makes the cause obvious.
     */
    it('omits the header entirely when no token is held', () => {
      setSessionCredentials({ mode: CREDENTIAL_MODES.bearer, token: null });

      assert.equal('Authorization' in jsonHeaders(), false);
      assert.equal(JSON.stringify(writeHeaders()).includes('undefined'), false);
    });

    it('never sends the CSRF proof, which belongs to the other scheme', () => {
      setSessionCredentials({
        mode: CREDENTIAL_MODES.bearer,
        token: 'tok-1',
        csrfToken: 'csrf-1',
      });

      assert.equal('X-Go-CSRF' in writeHeaders(), false);
    });
  });

  describe('cookie mode', () => {
    it('sends the CSRF proof on unsafe methods and no credential header', () => {
      setSessionCredentials({ mode: CREDENTIAL_MODES.cookie, csrfToken: 'csrf-1' });

      assert.equal(writeHeaders()['X-Go-CSRF'], 'csrf-1');
      assert.equal('Authorization' in writeHeaders(), false);
    });

    /**
     * A read needs no proof: the backend only requires X-Go-CSRF on unsafe
     * methods. Sending it on a GET would work but would blur which requests the
     * proof actually protects.
     */
    it('leaves reads free of the CSRF proof', () => {
      setSessionCredentials({ mode: CREDENTIAL_MODES.cookie, csrfToken: 'csrf-1' });

      assert.deepEqual(jsonHeaders(), { 'Content-Type': 'application/json' });
    });

    it('omits the CSRF header rather than sending an empty value', () => {
      setSessionCredentials({ mode: CREDENTIAL_MODES.cookie, csrfToken: null });

      assert.equal('X-Go-CSRF' in writeHeaders(), false);
    });

    /**
     * A bearer token left over from a previous session must not leak into the
     * cookie scheme: the session is the cookie, and sending a stale token
     * alongside it would let the backend authenticate the wrong identity if the
     * legacy path is still enabled.
     */
    it('ignores a leftover bearer token', () => {
      setSessionCredentials({
        mode: CREDENTIAL_MODES.cookie,
        token: 'stale-tok',
        csrfToken: 'csrf-1',
      });

      assert.equal('Authorization' in writeHeaders(), false);
      assert.equal(JSON.stringify(writeHeaders()).includes('stale-tok'), false);
    });
  });

  /**
   * ETP-4576 — `auto` exists because declaring the scheme by hand is a claim
   * about the BACKEND that the frontend cannot check, and the wrong claim fails
   * silently in one direction only: reads keep working off the browser's own
   * cookie while every unsafe request answers 403 for a missing CSRF proof.
   * The backend already reveals the answer — only a cookie session issues a CSRF
   * token — so these assert that the presence of that token IS the decision.
   */
  describe('auto mode', () => {
    it('resolves to cookie when a CSRF token is held', () => {
      setSessionCredentials({ mode: CREDENTIAL_MODES.auto, token: 'tk', csrfToken: 'csrf' });
      assert.equal(getCredentialMode(), CREDENTIAL_MODES.cookie);
    });

    it('resolves to bearer when no CSRF token is held, even with a token present', () => {
      setSessionCredentials({ mode: CREDENTIAL_MODES.auto, token: 'tk', csrfToken: null });
      assert.equal(getCredentialMode(), CREDENTIAL_MODES.bearer);
    });

    it('sends the CSRF proof and no Authorization once resolved to cookie', () => {
      setSessionCredentials({ mode: CREDENTIAL_MODES.auto, token: 'tk', csrfToken: 'csrf' });
      const headers = writeHeaders();
      assert.equal(headers['X-Go-CSRF'], 'csrf');
      assert.equal(headers.Authorization, undefined);
    });

    /**
     * The case that took down the integration suite: a hard-coded `cookie`
     * against a backend that never issued a CSRF token sent NEITHER credential.
     * Under `auto` the same state degrades to the scheme that still works.
     */
    it('sends the bearer credential when the backend issued no CSRF token', () => {
      setSessionCredentials({ mode: CREDENTIAL_MODES.auto, token: 'tk', csrfToken: null });
      const headers = writeHeaders();
      assert.equal(headers.Authorization, 'Bearer tk');
      assert.equal(headers['X-Go-CSRF'], undefined);
    });

    it('resolves to bearer before any session exists, so boot carries nothing it lacks', () => {
      setSessionCredentials({ mode: CREDENTIAL_MODES.auto });
      assert.equal(getCredentialMode(), CREDENTIAL_MODES.bearer);
      assert.equal(writeHeaders().Authorization, undefined);
    });

    it('re-resolves when the CSRF token arrives later, with no reload', () => {
      setSessionCredentials({ mode: CREDENTIAL_MODES.auto, token: 'tk' });
      assert.equal(getCredentialMode(), CREDENTIAL_MODES.bearer);
      setSessionCredentials({ mode: CREDENTIAL_MODES.auto, token: 'tk', csrfToken: 'csrf' });
      assert.equal(getCredentialMode(), CREDENTIAL_MODES.cookie);
    });

    it('leaves an explicitly pinned mode alone, so a rollback still overrides', () => {
      setSessionCredentials({ mode: CREDENTIAL_MODES.bearer, token: 'tk', csrfToken: 'csrf' });
      assert.equal(getCredentialMode(), CREDENTIAL_MODES.bearer);
      setSessionCredentials({ mode: CREDENTIAL_MODES.cookie, token: 'tk', csrfToken: null });
      assert.equal(getCredentialMode(), CREDENTIAL_MODES.cookie);
    });
  });

  describe('robustness', () => {
    /**
     * A control plane that answers with garbage must degrade to the scheme that
     * works, not break every request in the app.
     */
    it('falls back to bearer for an unrecognised mode', () => {
      setSessionCredentials({ mode: 'nonsense', token: 'tok-1' });

      assert.equal(getCredentialMode(), CREDENTIAL_MODES.bearer);
      assert.equal(jsonHeaders().Authorization, 'Bearer tok-1');
    });

    it('replaces the published credentials rather than merging them', () => {
      setSessionCredentials({ mode: CREDENTIAL_MODES.cookie, csrfToken: 'csrf-1' });
      setSessionCredentials({ mode: CREDENTIAL_MODES.cookie });

      assert.equal('X-Go-CSRF' in writeHeaders(), false);
    });

    it('resets to the defaults, so no test leaks a session into the next', () => {
      setSessionCredentials({ mode: CREDENTIAL_MODES.cookie, csrfToken: 'csrf-1' });
      resetSessionCredentials();

      assert.equal(getCredentialMode(), CREDENTIAL_MODES.bearer);
      assert.deepEqual(writeHeaders(), { 'Content-Type': 'application/json' });
    });

    it('returns a fresh headers object per call, so callers cannot poison it', () => {
      setSessionCredentials({ mode: CREDENTIAL_MODES.bearer, token: 'tok-1' });

      const first = writeHeaders();
      first['X-Injected'] = 'nope';

      assert.equal('X-Injected' in writeHeaders(), false);
    });
  });

  describe('credentialOptions', () => {
    /**
     * Unconditional in both schemes: under bearer it is a no-op for the
     * same-origin requests this app makes, and making it conditional would be a
     * second thing for every call site to get right.
     */
    it('always opts into sending credentials', () => {
      assert.deepEqual(credentialOptions(), { credentials: 'include' });

      setSessionCredentials({ mode: CREDENTIAL_MODES.cookie, csrfToken: 'csrf-1' });
      assert.deepEqual(credentialOptions(), { credentials: 'include' });
    });
  });
});

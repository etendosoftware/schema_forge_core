import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { REDACTED, isUntrustableKey, resolveTrustedKeys, sanitizeValue } from '../sanitize.js';
import { createTelemetryGateway } from '../gateway.js';
import { createSentryAdapter } from '../adapters/sentry.js';
import { createMixpanelAdapter } from '../adapters/mixpanel.js';

// ETP-4578 C6 (D9): `trustedKeys` exempts an approved key from the sensitive-key-NAME rule
// (a `session_id` analytics dimension would otherwise be [REDACTED]), and nothing else.

const FAKE_BEARER = 'Bearer FAKE_TEST_TOKEN_ab12cd34ef56gh78ij90kl12mn34op56';

describe('trustedKeys (ETP-4578 D9)', () => {
  const input = { session_id: 'abc', token_count: 3, action: 'save' };
  const allowedKeys = ['session_id', 'token_count', 'action'];

  it('without it, an allowed key with a sensitive-looking NAME is redacted', () => {
    assert.deepEqual(sanitizeValue(input, { allowedKeys }), { session_id: REDACTED, token_count: REDACTED, action: 'save' });
  });

  it('keeps only the trusted key readable', () => {
    assert.deepEqual(
      sanitizeValue(input, { allowedKeys, trustedKeys: ['session_id'] }),
      { session_id: 'abc', token_count: REDACTED, action: 'save' },
    );
  });

  it('never widens the allowlist: a trusted key that is not allowed is still dropped', () => {
    assert.deepEqual(sanitizeValue(input, { allowedKeys: ['action'], trustedKeys: ['session_id', 'token_count'] }), { action: 'save' });
  });

  it('does not skip the value scrub: a secret in a trusted key is still redacted', () => {
    const out = sanitizeValue({ session_id: FAKE_BEARER }, { allowedKeys: ['session_id'], trustedKeys: ['session_id'] });
    assert.equal(out.session_id, REDACTED);
  });

  it('applies at any depth, by key name', () => {
    assert.deepEqual(
      sanitizeValue({ context: { session_id: 'abc' } }, { allowedKeys: ['context', 'session_id'], trustedKeys: ['session_id'] }),
      { context: { session_id: 'abc' } },
    );
  });

  it('accepts a Set, an array or a string, and ignores junk', () => {
    for (const trustedKeys of [new Set(['session_id']), ['session_id'], 'session_id']) {
      assert.equal(sanitizeValue({ session_id: 'abc' }, { allowedKeys: ['session_id'], trustedKeys }).session_id, 'abc');
    }
    assert.equal(sanitizeValue({ session_id: 'abc' }, { allowedKeys: ['session_id'], trustedKeys: [1, null, {}] }).session_id, REDACTED);
    assert.equal(sanitizeValue({ session_id: 'abc' }, { allowedKeys: ['session_id'], trustedKeys: undefined }).session_id, REDACTED);
  });

  it('is forwarded by the gateway to every adapter payload', async () => {
    const calls = [];
    const adapter = { name: 'test', track: (...args) => { calls.push(args); } };
    const gateway = createTelemetryGateway({ adapters: [adapter], allowedKeys, trustedKeys: ['session_id'], logger: { warn() {} } });
    await gateway.init({});
    await gateway.track('clicked', input);
    assert.deepEqual(calls[0][1], { session_id: 'abc', token_count: REDACTED, action: 'save' });
  });
});

// ETP-4578 NB-A: a trustedKeys list that names a credential-like key must not switch the
// key-name defence off, because the value scrub only catches long or token-shaped secrets.
describe('untrustable names (ETP-4578 NB-A)', () => {
  const SHORT_SECRETS = { password: 'hunter2', authorization: 'Basic abc', cookie: 'sid=abc123', token: 'a1b2c3' };
  const names = Object.keys(SHORT_SECRETS);

  it('ignores a credential-like name in trustedKeys, so a short secret is still redacted', () => {
    const out = sanitizeValue(SHORT_SECRETS, { allowedKeys: names, trustedKeys: ['password', 'authorization', 'cookie'] });
    assert.deepEqual(out, { password: REDACTED, authorization: REDACTED, cookie: REDACTED, token: REDACTED });
  });

  it('classifies the credential names, and leaves session_id and token_count trustable', () => {
    for (const key of ['password', 'passwd', 'secret', 'clientSecret', 'cookie', 'Authorization', 'credentials', 'privateKey', 'creditCard', 'cardNumber', 'bearer', 'apiKey', 'accessKey', 'pwd', 'jwt']) {
      assert.equal(isUntrustableKey(key), true, key);
    }
    for (const key of ['session_id', 'token_count', 'account_id', 'action']) assert.equal(isUntrustableKey(key), false, key);
  });

  it('keeps a legitimately trusted key exempt when it is listed next to a denied one', () => {
    const out = sanitizeValue({ session_id: 'abc', password: 'hunter2' }, { allowedKeys: ['session_id', 'password'], trustedKeys: ['session_id', 'password'] });
    assert.deepEqual(out, { session_id: 'abc', password: REDACTED });
  });

  it('resolveTrustedKeys drops the denied names and warns once, naming them', () => {
    const warnings = [];
    const kept = resolveTrustedKeys(['session_id', 'password', 'cookie'], { warn: (message) => warnings.push(message) });
    assert.deepEqual(kept, ['session_id']);
    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /password, cookie/);
    assert.equal(resolveTrustedKeys(['session_id'], { warn: () => assert.fail('nothing to warn about') }).length, 1);
  });

  it('the gateway warns at creation and never trusts the denied names', async () => {
    const warnings = [];
    const calls = [];
    const gateway = createTelemetryGateway({
      adapters: [{ name: 'test', track: (...args) => { calls.push(args); } }],
      allowedKeys: names,
      trustedKeys: ['password', 'authorization', 'cookie', 'token'],
      logger: { warn: (message) => warnings.push(message) },
    });
    await gateway.init({});
    await gateway.track('x', SHORT_SECRETS);
    assert.equal(warnings.length, 1);
    assert.deepEqual(calls[0][1], { password: REDACTED, authorization: REDACTED, cookie: REDACTED, token: 'a1b2c3' });
  });

  it('createSentryAdapter and createMixpanelAdapter warn about a denied name too', () => {
    for (const create of [
      (logger) => createSentryAdapter({ sdk: {}, dsn: 'https://k@glitchtip.example/1', allowedKeys: ['password'], trustedKeys: ['password'], logger }),
      (logger) => createMixpanelAdapter({ loadSdk: async () => ({}), enabled: true, token: 't', allowedKeys: ['password'], trustedKeys: ['password'], logger }),
    ]) {
      const warnings = [];
      create({ warn: (message) => warnings.push(message) });
      assert.equal(warnings.length, 1);
    }
  });
});

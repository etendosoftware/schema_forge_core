import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { REDACTED, sanitizeValue } from '../sanitize.js';
import { createTelemetryGateway } from '../gateway.js';

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

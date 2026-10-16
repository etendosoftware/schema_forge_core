// @covers packages/api-gateway-core/src/http/public-api-key.guard.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { PublicApiKeyGuard, type PublicApiKeyRequest } from '../../src/http/public-api-key.guard.ts';
import type { CachedTokenExchangeService } from '../../src/auth/cached-token-exchange.service.ts';
import { InvalidApiKeyError, TokenExchangeUnavailableError } from '../../src/auth/token-exchange.service.ts';

type FakeRequest = { headers: Record<string, string> } & Partial<PublicApiKeyRequest>;

function fakeContext(request: FakeRequest) {
  return { switchToHttp: () => ({ getRequest: () => request }) } as any;
}

function fakeTokenExchange(
  jwt: string,
  calls: Array<[string, string]>,
  options: { secret?: string; failWith?: unknown; evicted?: string[] } = {}
) {
  const secret = options.secret ?? 'secret-1';
  return {
    getJwtForApiKey: async (apiKeyId: string, apiKeySecret: string) => {
      calls.push([apiKeyId, apiKeySecret]);
      if (options.failWith !== undefined) throw options.failWith;
      if (apiKeyId !== 'client-1' || apiKeySecret !== secret) {
        throw new InvalidApiKeyError(401, 'invalid_client');
      }
      return jwt;
    },
    evictJwt: (token: string) => {
      options.evicted?.push(token);
      return true;
    },
  } as unknown as CachedTokenExchangeService;
}

test('throws "Missing API key" when there is no Authorization header', async () => {
  const guard = new PublicApiKeyGuard(fakeTokenExchange('jwt', []));
  await assert.rejects(() => guard.canActivate(fakeContext({ headers: {} })), /Missing API key/);
});

test('throws "Malformed API key" when the bearer value has no colon', async () => {
  const guard = new PublicApiKeyGuard(fakeTokenExchange('jwt', []));
  await assert.rejects(
    () => guard.canActivate(fakeContext({ headers: { authorization: 'Bearer notacolonseparatedvalue' } })),
    /Malformed API key/
  );
});

for (const value of [':secret-only', 'client-only:']) {
  test(`throws "Malformed API key" for an empty half ("${value}")`, async () => {
    const calls: Array<[string, string]> = [];
    const guard = new PublicApiKeyGuard(fakeTokenExchange('jwt', calls));
    await assert.rejects(
      () => guard.canActivate(fakeContext({ headers: { authorization: `Bearer ${value}` } })),
      /Malformed API key/
    );
    assert.equal(calls.length, 0);
  });
}

test('answers 401 "Invalid API key" when Etendo refuses the credential', async () => {
  const guard = new PublicApiKeyGuard(fakeTokenExchange('jwt', []));
  await assert.rejects(
    () => guard.canActivate(fakeContext({ headers: { authorization: 'Bearer wrong:wrong' } })),
    (err: unknown) => err instanceof UnauthorizedException && /Invalid API key/.test(err.message)
  );
});

test('answers 503 without details when Etendo is unavailable', async () => {
  const guard = new PublicApiKeyGuard(
    fakeTokenExchange('jwt', [], {
      failWith: new TokenExchangeUnavailableError('OAuth2 token endpoint answered 502', 502),
    })
  );
  await assert.rejects(
    () => guard.canActivate(fakeContext({ headers: { authorization: 'Bearer client-1:secret-1' } })),
    (err: unknown) =>
      err instanceof ServiceUnavailableException &&
      err.getStatus() === 503 &&
      !err.message.includes('502') &&
      !err.message.includes('secret-1')
  );
});

test('an unexpected exchange error is a 503, never a 401 that blames the key', async () => {
  const guard = new PublicApiKeyGuard(fakeTokenExchange('jwt', [], { failWith: new Error('boom') }));
  await assert.rejects(
    () => guard.canActivate(fakeContext({ headers: { authorization: 'Bearer client-1:secret-1' } })),
    ServiceUnavailableException
  );
});

test('parses a normally single-spaced header correctly and attaches the exchanged JWT', async () => {
  const calls: Array<[string, string]> = [];
  const guard = new PublicApiKeyGuard(fakeTokenExchange('jwt-abc', calls));
  const request: FakeRequest = { headers: { authorization: 'Bearer client-1:secret-1' } };
  const result = await guard.canActivate(fakeContext(request));
  assert.equal(result, true);
  assert.equal(request.neoJwt, 'jwt-abc');
  assert.deepEqual(calls, [['client-1', 'secret-1']]);
});

test('tolerates extra whitespace after "Bearer" (e.g. Scalar\'s try-it-out UI) without corrupting the key', async () => {
  const calls: Array<[string, string]> = [];
  const guard = new PublicApiKeyGuard(fakeTokenExchange('jwt-abc', calls));
  // Two spaces after "Bearer" — a fixed 7-char slice leaves a leading space
  // glued onto apiKeyId ("client-1" becomes " client-1"), which fails the
  // exchange and surfaces as a misleading "Invalid API key" for a key that
  // is actually fine (ETP-5345).
  const request: FakeRequest = { headers: { authorization: 'Bearer  client-1:secret-1' } };
  const result = await guard.canActivate(fakeContext(request));
  assert.equal(result, true);
  assert.equal(request.neoJwt, 'jwt-abc');
  assert.deepEqual(calls, [['client-1', 'secret-1']]);
});

test('splits on the first colon only, so a secret containing ":" reaches Etendo whole', async () => {
  const calls: Array<[string, string]> = [];
  const guard = new PublicApiKeyGuard(fakeTokenExchange('jwt-abc', calls, { secret: 'se:cr:et' }));
  const request: FakeRequest = { headers: { authorization: 'Bearer client-1:se:cr:et' } };
  assert.equal(await guard.canActivate(fakeContext(request)), true);
  assert.deepEqual(calls, [['client-1', 'se:cr:et']]);
});

test('attaches an evictNeoJwt closure that evicts exactly the token it attached', async () => {
  const evicted: string[] = [];
  const guard = new PublicApiKeyGuard(fakeTokenExchange('jwt-abc', [], { evicted }));
  const request: FakeRequest = { headers: { authorization: 'Bearer client-1:secret-1' } };
  await guard.canActivate(fakeContext(request));

  assert.equal(typeof request.evictNeoJwt, 'function');
  request.evictNeoJwt!();
  assert.deepEqual(evicted, ['jwt-abc']);
});

function spyLogger(guard: PublicApiKeyGuard) {
  const lines: Array<{ level: 'warn' | 'error'; text: string }> = [];
  (guard as unknown as { logger: unknown }).logger = {
    warn: (...args: unknown[]) => lines.push({ level: 'warn', text: args.map(String).join(' ') }),
    error: (...args: unknown[]) => lines.push({ level: 'error', text: args.map(String).join(' ') }),
  };
  return lines;
}

test('an unavailable exchange is logged as a warning with message and cause codes, never the secret', async () => {
  const connRefused = Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:8080'), { code: 'ECONNREFUSED' });
  const fetchFailed = new TypeError('fetch failed', { cause: connRefused });
  const guard = new PublicApiKeyGuard(
    fakeTokenExchange('jwt', [], {
      failWith: new TokenExchangeUnavailableError('OAuth2 token endpoint unreachable', undefined, { cause: fetchFailed }),
    })
  );
  const lines = spyLogger(guard);
  await assert.rejects(
    () => guard.canActivate(fakeContext({ headers: { authorization: 'Bearer client-1:top-secret-value' } })),
    ServiceUnavailableException
  );
  assert.equal(lines.length, 1);
  assert.equal(lines[0].level, 'warn');
  assert.match(lines[0].text, /OAuth2 token endpoint unreachable/);
  assert.match(lines[0].text, /TypeError/);
  assert.match(lines[0].text, /ECONNREFUSED/);
  assert.ok(!lines[0].text.includes('top-secret-value'));
});

test('a timeout is logged with the TimeoutError cause name', async () => {
  const timeout = new DOMException('The operation was aborted due to timeout', 'TimeoutError');
  const guard = new PublicApiKeyGuard(
    fakeTokenExchange('jwt', [], {
      failWith: new TokenExchangeUnavailableError('OAuth2 token endpoint unreachable', undefined, { cause: timeout }),
    })
  );
  const lines = spyLogger(guard);
  await assert.rejects(
    () => guard.canActivate(fakeContext({ headers: { authorization: 'Bearer client-1:top-secret-value' } })),
    ServiceUnavailableException
  );
  assert.match(lines[0].text, /TimeoutError/);
  assert.ok(!lines[0].text.includes('top-secret-value'));
});

test('an unclassified exchange error is logged at error level with its stack, never the secret', async () => {
  const guard = new PublicApiKeyGuard(fakeTokenExchange('jwt', [], { failWith: new RangeError('boom') }));
  const lines = spyLogger(guard);
  await assert.rejects(
    () => guard.canActivate(fakeContext({ headers: { authorization: 'Bearer client-1:top-secret-value' } })),
    ServiceUnavailableException
  );
  assert.equal(lines.length, 1);
  assert.equal(lines[0].level, 'error');
  assert.match(lines[0].text, /RangeError/);
  assert.match(lines[0].text, /at /, 'the stack is included');
  assert.ok(!lines[0].text.includes('top-secret-value'));
});

test('a refused credential is not logged at all', async () => {
  const guard = new PublicApiKeyGuard(fakeTokenExchange('jwt', []));
  const lines = spyLogger(guard);
  await assert.rejects(
    () => guard.canActivate(fakeContext({ headers: { authorization: 'Bearer client-1:top-secret-value' } })),
    UnauthorizedException
  );
  assert.equal(lines.length, 0);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PublicApiKeyGuard } from '../../src/http/public-api-key.guard.ts';
import type { CachedTokenExchangeService } from '../../src/auth/cached-token-exchange.service.ts';

function fakeContext(headers: Record<string, string>) {
  return {
    switchToHttp: () => ({ getRequest: () => ({ headers }) }),
  } as any;
}

function fakeTokenExchange(jwt: string, calls: Array<[string, string]>) {
  return {
    getJwtForApiKey: async (apiKeyId: string, apiKeySecret: string) => {
      calls.push([apiKeyId, apiKeySecret]);
      if (apiKeyId !== 'client-1' || apiKeySecret !== 'secret-1') {
        throw new Error('invalid_client');
      }
      return jwt;
    },
  } as unknown as CachedTokenExchangeService;
}

test('throws "Missing API key" when there is no Authorization header', async () => {
  const guard = new PublicApiKeyGuard(fakeTokenExchange('jwt', []));
  await assert.rejects(() => guard.canActivate(fakeContext({})), /Missing API key/);
});

test('throws "Malformed API key" when the bearer value has no colon', async () => {
  const guard = new PublicApiKeyGuard(fakeTokenExchange('jwt', []));
  await assert.rejects(
    () => guard.canActivate(fakeContext({ authorization: 'Bearer notacolonseparatedvalue' })),
    /Malformed API key/
  );
});

test('throws "Invalid API key" when the exchange rejects the credentials', async () => {
  const guard = new PublicApiKeyGuard(fakeTokenExchange('jwt', []));
  await assert.rejects(
    () => guard.canActivate(fakeContext({ authorization: 'Bearer wrong:wrong' })),
    /Invalid API key/
  );
});

test('parses a normally single-spaced header correctly and attaches the exchanged JWT', async () => {
  const calls: Array<[string, string]> = [];
  const guard = new PublicApiKeyGuard(fakeTokenExchange('jwt-abc', calls));
  const request: { headers: Record<string, string>; neoJwt?: string } = {
    headers: { authorization: 'Bearer client-1:secret-1' },
  };
  const context = { switchToHttp: () => ({ getRequest: () => request }) } as any;
  const result = await guard.canActivate(context);
  assert.equal(result, true);
  assert.equal(request.neoJwt, 'jwt-abc');
  assert.deepEqual(calls, [['client-1', 'secret-1']]);
});

test('tolerates extra whitespace after "Bearer" (e.g. Scalar\'s try-it-out UI) without corrupting the key', async () => {
  const calls: Array<[string, string]> = [];
  const guard = new PublicApiKeyGuard(fakeTokenExchange('jwt-abc', calls));
  const request: { headers: Record<string, string>; neoJwt?: string } = {
    // Two spaces after "Bearer" — a fixed 7-char slice leaves a leading space
    // glued onto apiKeyId ("client-1" becomes " client-1"), which fails the
    // exchange and surfaces as a misleading "Invalid API key" for a key that
    // is actually fine (ETP-5345).
    headers: { authorization: 'Bearer  client-1:secret-1' },
  };
  const context = { switchToHttp: () => ({ getRequest: () => request }) } as any;
  const result = await guard.canActivate(context);
  assert.equal(result, true);
  assert.equal(request.neoJwt, 'jwt-abc');
  assert.deepEqual(calls, [['client-1', 'secret-1']]);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CachedTokenExchangeService } from '../../src/auth/cached-token-exchange.service.ts';
import type { TokenExchangeService, TokenExchangeResult } from '../../src/auth/token-exchange.service.ts';

function fakeExchanger(results: TokenExchangeResult[]) {
  let call = 0;
  return {
    calls: 0,
    exchangeApiKeyForJwt: async () => {
      const r = results[Math.min(call, results.length - 1)];
      call += 1;
      return r;
    },
  } as unknown as TokenExchangeService & { calls: number };
}

test('returns the cached JWT on a second call before expiry', async () => {
  const now = Math.floor(Date.now() / 1000);
  const exchanger = fakeExchanger([{ jwt: 'jwt-1', expiresAt: now + 300 }]);
  const cache = new CachedTokenExchangeService(exchanger);
  const first = await cache.getJwtForApiKey('id-1', 'secret-1');
  const second = await cache.getJwtForApiKey('id-1', 'secret-1');
  assert.equal(first, 'jwt-1');
  assert.equal(second, 'jwt-1');
});

test('re-exchanges once the cached JWT has expired', async () => {
  const now = Math.floor(Date.now() / 1000);
  const exchanger = fakeExchanger([
    { jwt: 'jwt-1', expiresAt: now - 1 }, // already expired
    { jwt: 'jwt-2', expiresAt: now + 300 },
  ]);
  const cache = new CachedTokenExchangeService(exchanger);
  const first = await cache.getJwtForApiKey('id-1', 'secret-1');
  const second = await cache.getJwtForApiKey('id-1', 'secret-1');
  assert.equal(first, 'jwt-1');
  assert.equal(second, 'jwt-2');
});

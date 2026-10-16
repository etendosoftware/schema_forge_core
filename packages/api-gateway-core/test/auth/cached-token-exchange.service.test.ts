// @covers packages/api-gateway-core/src/auth/cached-token-exchange.service.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CachedTokenExchangeService,
  TOKEN_CACHE_SAFETY_MARGIN_SECONDS,
} from '../../src/auth/cached-token-exchange.service.ts';
import {
  InvalidApiKeyError,
  TokenExchangeUnavailableError,
  type TokenExchangeService,
  type TokenExchangeResult,
} from '../../src/auth/token-exchange.service.ts';

type Outcome = TokenExchangeResult | Error;

function fakeExchanger(results: Outcome[]) {
  const calls: Array<[string, string]> = [];
  const exchanger = {
    exchangeApiKeyForJwt: async (id: string, secret: string) => {
      const r = results[Math.min(calls.length, results.length - 1)];
      calls.push([id, secret]);
      if (r instanceof Error) throw r;
      return r;
    },
  } as unknown as TokenExchangeService;
  return { exchanger, calls };
}

/** A clock frozen at a whole second, moved by hand. */
function fakeClock(startSeconds = 1_800_000_000) {
  let ms = startSeconds * 1000;
  return {
    now: () => ms,
    seconds: () => Math.floor(ms / 1000),
    advance: (seconds: number) => {
      ms += seconds * 1000;
    },
  };
}

test('returns the cached JWT on a second call before expiry', async () => {
  const now = Math.floor(Date.now() / 1000);
  const { exchanger, calls } = fakeExchanger([{ jwt: 'jwt-1', expiresAt: now + 300 }]);
  const cache = new CachedTokenExchangeService(exchanger);
  const first = await cache.getJwtForApiKey('id-1', 'secret-1');
  const second = await cache.getJwtForApiKey('id-1', 'secret-1');
  assert.equal(first, 'jwt-1');
  assert.equal(second, 'jwt-1');
  assert.equal(calls.length, 1);
});

test('re-exchanges once the cached JWT has expired', async () => {
  const now = Math.floor(Date.now() / 1000);
  const { exchanger } = fakeExchanger([
    { jwt: 'jwt-1', expiresAt: now - 1 }, // already expired
    { jwt: 'jwt-2', expiresAt: now + 300 },
  ]);
  const cache = new CachedTokenExchangeService(exchanger);
  const first = await cache.getJwtForApiKey('id-1', 'secret-1');
  const second = await cache.getJwtForApiKey('id-1', 'secret-1');
  assert.equal(first, 'jwt-1');
  assert.equal(second, 'jwt-2');
});

test('a wrong secret never hits the cached JWT of the same client id', async () => {
  const clock = fakeClock();
  const { exchanger, calls } = fakeExchanger([
    { jwt: 'jwt-1', expiresAt: clock.seconds() + 3600 },
    new InvalidApiKeyError(401, 'invalid_client'),
  ]);
  const cache = new CachedTokenExchangeService(exchanger, { now: clock.now });
  assert.equal(await cache.getJwtForApiKey('id-1', 'right-secret'), 'jwt-1');

  await assert.rejects(() => cache.getJwtForApiKey('id-1', 'wrong-secret'), InvalidApiKeyError);
  assert.deepEqual(calls, [
    ['id-1', 'right-secret'],
    ['id-1', 'wrong-secret'],
  ]);
});

test('an id/secret pair split differently does not collide with another credential', async () => {
  const clock = fakeClock();
  const { exchanger, calls } = fakeExchanger([
    { jwt: 'jwt-a', expiresAt: clock.seconds() + 3600 },
    { jwt: 'jwt-b', expiresAt: clock.seconds() + 3600 },
  ]);
  const cache = new CachedTokenExchangeService(exchanger, { now: clock.now });
  assert.equal(await cache.getJwtForApiKey('a:b', 'c'), 'jwt-a');
  assert.equal(await cache.getJwtForApiKey('a', 'b:c'), 'jwt-b');
  assert.equal(calls.length, 2);
});

test('stops serving a cached JWT the safety margin before Etendo expires it', async () => {
  const clock = fakeClock();
  const { exchanger, calls } = fakeExchanger([
    { jwt: 'jwt-1', expiresAt: clock.seconds() + 3600 },
    { jwt: 'jwt-2', expiresAt: clock.seconds() + 7200 },
  ]);
  const cache = new CachedTokenExchangeService(exchanger, { now: clock.now });
  await cache.getJwtForApiKey('id-1', 'secret-1');

  clock.advance(3600 - TOKEN_CACHE_SAFETY_MARGIN_SECONDS - 1);
  assert.equal(await cache.getJwtForApiKey('id-1', 'secret-1'), 'jwt-1');
  clock.advance(1); // exactly at expiry minus margin
  assert.equal(await cache.getJwtForApiKey('id-1', 'secret-1'), 'jwt-2');
  assert.equal(calls.length, 2);
});

test('a token living no longer than the margin is returned but not cached', async () => {
  const clock = fakeClock();
  const { exchanger, calls } = fakeExchanger([
    { jwt: 'jwt-short', expiresAt: clock.seconds() + TOKEN_CACHE_SAFETY_MARGIN_SECONDS },
  ]);
  const cache = new CachedTokenExchangeService(exchanger, { now: clock.now });
  assert.equal(await cache.getJwtForApiKey('id-1', 'secret-1'), 'jwt-short');
  assert.equal(await cache.getJwtForApiKey('id-1', 'secret-1'), 'jwt-short');
  assert.equal(calls.length, 2);
  assert.equal(cache.size, 0);
});

test('a zero lifetime (missing expires_in) is never cached', async () => {
  const clock = fakeClock();
  const { exchanger, calls } = fakeExchanger([{ jwt: 'jwt-0', expiresAt: clock.seconds() }]);
  const cache = new CachedTokenExchangeService(exchanger, { now: clock.now });
  await cache.getJwtForApiKey('id-1', 'secret-1');
  await cache.getJwtForApiKey('id-1', 'secret-1');
  assert.equal(calls.length, 2);
  assert.equal(cache.size, 0);
});

test('a failed exchange is not cached: the next call asks Etendo again', async () => {
  const clock = fakeClock();
  const { exchanger, calls } = fakeExchanger([
    new TokenExchangeUnavailableError('OAuth2 token endpoint answered 503', 503),
    { jwt: 'jwt-1', expiresAt: clock.seconds() + 3600 },
  ]);
  const cache = new CachedTokenExchangeService(exchanger, { now: clock.now });
  await assert.rejects(() => cache.getJwtForApiKey('id-1', 'secret-1'), TokenExchangeUnavailableError);
  assert.equal(cache.size, 0);
  assert.equal(await cache.getJwtForApiKey('id-1', 'secret-1'), 'jwt-1');
  assert.equal(calls.length, 2);
});

test('caps the number of entries, evicting the least recently used first', async () => {
  const clock = fakeClock();
  let exchanges = 0;
  const exchanger = {
    exchangeApiKeyForJwt: async (id: string) => {
      exchanges += 1;
      return { jwt: `jwt-${id}`, expiresAt: clock.seconds() + 3600 };
    },
  } as unknown as TokenExchangeService;
  const cache = new CachedTokenExchangeService(exchanger, { now: clock.now, maxEntries: 2 });

  await cache.getJwtForApiKey('a', 's');
  await cache.getJwtForApiKey('b', 's');
  await cache.getJwtForApiKey('a', 's'); // touch "a": "b" is now the oldest
  await cache.getJwtForApiKey('c', 's'); // evicts "b"
  assert.equal(cache.size, 2);
  assert.equal(exchanges, 3);

  await cache.getJwtForApiKey('a', 's');
  await cache.getJwtForApiKey('c', 's');
  assert.equal(exchanges, 3, '"a" and "c" are still cached');
  await cache.getJwtForApiKey('b', 's');
  assert.equal(exchanges, 4, '"b" was evicted and had to be re-exchanged');
});

test('purges expired entries before evicting live ones when full', async () => {
  const clock = fakeClock();
  const lifetimes: Record<string, number> = { short: 60, long: 3600, next: 3600 };
  let exchanges = 0;
  const exchanger = {
    exchangeApiKeyForJwt: async (id: string) => {
      exchanges += 1;
      return { jwt: `jwt-${id}`, expiresAt: clock.seconds() + lifetimes[id] };
    },
  } as unknown as TokenExchangeService;
  const cache = new CachedTokenExchangeService(exchanger, { now: clock.now, maxEntries: 2 });

  await cache.getJwtForApiKey('long', 's');
  await cache.getJwtForApiKey('short', 's');
  clock.advance(60); // "short" is past its usable window, "long" is the oldest live entry
  await cache.getJwtForApiKey('next', 's');

  assert.equal(cache.size, 2);
  await cache.getJwtForApiKey('long', 's');
  assert.equal(exchanges, 3, 'the expired entry was purged, the oldest live one kept');
});

test('evictJwt drops the entry holding that token so the next call re-exchanges', async () => {
  const clock = fakeClock();
  const { exchanger, calls } = fakeExchanger([
    { jwt: 'jwt-1', expiresAt: clock.seconds() + 3600 },
    { jwt: 'jwt-2', expiresAt: clock.seconds() + 3600 },
  ]);
  const cache = new CachedTokenExchangeService(exchanger, { now: clock.now });
  await cache.getJwtForApiKey('id-1', 'secret-1');

  assert.equal(cache.evictJwt('jwt-1'), true);
  assert.equal(await cache.getJwtForApiKey('id-1', 'secret-1'), 'jwt-2');
  assert.equal(calls.length, 2);
});

test('evictJwt for a token that is no longer cached leaves the fresh entry alone', async () => {
  const clock = fakeClock();
  const { exchanger, calls } = fakeExchanger([{ jwt: 'jwt-2', expiresAt: clock.seconds() + 3600 }]);
  const cache = new CachedTokenExchangeService(exchanger, { now: clock.now });
  await cache.getJwtForApiKey('id-1', 'secret-1');

  assert.equal(cache.evictJwt('jwt-old'), false);
  assert.equal(await cache.getJwtForApiKey('id-1', 'secret-1'), 'jwt-2');
  assert.equal(calls.length, 1);
});

// @covers packages/api-gateway-core/src/auth/token-exchange.service.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  InvalidApiKeyError,
  TokenExchangeService,
  TokenExchangeUnavailableError,
} from '../../src/auth/token-exchange.service.ts';

const BASE_URL = 'http://localhost:8080/etendo';

function serviceAnswering(response: () => Response | Promise<Response>) {
  return new TokenExchangeService(BASE_URL, (async () => response()) as typeof fetch);
}

test('exchanges an API key for a JWT using the OAuth2 client_credentials grant', async () => {
  const fetchCalls: Array<[string, RequestInit]> = [];
  const fakeFetch = async (url: string, init: RequestInit) => {
    fetchCalls.push([url, init]);
    return new Response(
      JSON.stringify({
        access_token: 'jwt-abc123',
        token_type: 'Bearer',
        expires_in: 300,
        scope: 'etendo:read',
      }),
      { status: 200 }
    );
  };
  const service = new TokenExchangeService(BASE_URL, fakeFetch as typeof fetch);
  const before = Math.floor(Date.now() / 1000);
  const result = await service.exchangeApiKeyForJwt('client-id-1', 'client-secret-1');

  assert.equal(result.jwt, 'jwt-abc123');
  assert.ok(result.expiresAt >= before + 300);
  assert.equal(fetchCalls.length, 1);
  const [url, init] = fetchCalls[0];
  assert.equal(url, 'http://localhost:8080/etendo/oauth2/token');
  assert.ok(init.signal instanceof AbortSignal, 'the call carries a timeout signal');
  const body = new URLSearchParams(init.body as string);
  assert.equal(body.get('grant_type'), 'client_credentials');
  assert.equal(body.get('client_id'), 'client-id-1');
  assert.equal(body.get('client_secret'), 'client-secret-1');
});

test('a 401 invalid_client (unknown, inactive or wrong secret) is an InvalidApiKeyError', async () => {
  const service = serviceAnswering(
    () => new Response(JSON.stringify({ error: 'invalid_client' }), { status: 401 })
  );
  await assert.rejects(
    () => service.exchangeApiKeyForJwt('bad-id', 'bad-secret'),
    (err: unknown) =>
      err instanceof InvalidApiKeyError && err.status === 401 && err.oauthError === 'invalid_client'
  );
});

test('a 400 (malformed request) is an InvalidApiKeyError too', async () => {
  const service = serviceAnswering(
    () => new Response(JSON.stringify({ error: 'invalid_request' }), { status: 400 })
  );
  await assert.rejects(() => service.exchangeApiKeyForJwt('id', 'secret'), InvalidApiKeyError);
});

test('the error never carries the secret', async () => {
  const service = serviceAnswering(
    () => new Response(JSON.stringify({ error: 'invalid_client' }), { status: 401 })
  );
  await assert.rejects(
    () => service.exchangeApiKeyForJwt('id', 'super-secret-value'),
    (err: unknown) => err instanceof Error && !err.message.includes('super-secret-value')
  );
});

for (const status of [500, 502, 503]) {
  test(`a ${status} is a TokenExchangeUnavailableError, not an invalid credential`, async () => {
    const service = serviceAnswering(
      () => new Response(JSON.stringify({ error: 'server_error' }), { status })
    );
    await assert.rejects(
      () => service.exchangeApiKeyForJwt('id', 'secret'),
      (err: unknown) => err instanceof TokenExchangeUnavailableError && err.status === status
    );
  });
}

for (const status of [408, 429]) {
  test(`a transient ${status} is a TokenExchangeUnavailableError`, async () => {
    const service = serviceAnswering(() => new Response('{}', { status }));
    await assert.rejects(() => service.exchangeApiKeyForJwt('id', 'secret'), TokenExchangeUnavailableError);
  });
}

test('a network error is a TokenExchangeUnavailableError that keeps the cause', async () => {
  const cause = new TypeError('fetch failed');
  const service = serviceAnswering(() => {
    throw cause;
  });
  await assert.rejects(
    () => service.exchangeApiKeyForJwt('id', 'secret'),
    (err: unknown) => err instanceof TokenExchangeUnavailableError && err.cause === cause
  );
});

test('a hung token endpoint is cut off by the timeout', async () => {
  const hangingFetch = (_url: string, init: RequestInit) =>
    new Promise<Response>((_resolve, reject) => {
      init.signal?.addEventListener('abort', () => reject(init.signal?.reason));
    });
  const service = new TokenExchangeService(BASE_URL, hangingFetch as typeof fetch, { timeoutMs: 20 });
  // AbortSignal.timeout's timer is unref'd: without a ref'd one the test process would see an
  // empty event loop and cancel the test before the signal fires.
  const keepAlive = setTimeout(() => {}, 5_000);
  try {
    await assert.rejects(() => service.exchangeApiKeyForJwt('id', 'secret'), TokenExchangeUnavailableError);
  } finally {
    clearTimeout(keepAlive);
  }
});

test('an unparsable 200 body (e.g. an HTML proxy page) is a TokenExchangeUnavailableError', async () => {
  const service = serviceAnswering(() => new Response('<html>Bad gateway</html>', { status: 200 }));
  await assert.rejects(() => service.exchangeApiKeyForJwt('id', 'secret'), TokenExchangeUnavailableError);
});

test('an unparsable 5xx body is still a TokenExchangeUnavailableError', async () => {
  const service = serviceAnswering(() => new Response('<html>oops</html>', { status: 502 }));
  await assert.rejects(() => service.exchangeApiKeyForJwt('id', 'secret'), TokenExchangeUnavailableError);
});

test('a 200 without access_token is a TokenExchangeUnavailableError', async () => {
  const service = serviceAnswering(() => new Response(JSON.stringify({ expires_in: 3600 }), { status: 200 }));
  await assert.rejects(() => service.exchangeApiKeyForJwt('id', 'secret'), TokenExchangeUnavailableError);
});

for (const [label, expiresIn] of [
  ['missing', undefined],
  ['zero', 0],
  ['negative', -5],
  ['non-numeric', 'soon'],
] as const) {
  test(`a ${label} expires_in yields an expiry equal to now (lifetime 0)`, async () => {
    const service = serviceAnswering(
      () => new Response(JSON.stringify({ access_token: 'jwt', expires_in: expiresIn }), { status: 200 })
    );
    const before = Math.floor(Date.now() / 1000);
    const result = await service.exchangeApiKeyForJwt('id', 'secret');
    const after = Math.floor(Date.now() / 1000);
    assert.ok(result.expiresAt >= before && result.expiresAt <= after);
  });
}

test('never follows a redirect, so client_secret is not re-sent to its target', async () => {
  const { createServer } = await import('node:http');
  let targetHits = 0;
  const target = createServer((_req, res) => {
    targetHits += 1;
    res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ access_token: 'stolen' }));
  });
  await new Promise<void>((resolve) => target.listen(0, '127.0.0.1', resolve));
  const targetPort = (target.address() as { port: number }).port;
  const origin = createServer((_req, res) => {
    res.writeHead(307, { Location: `http://127.0.0.1:${targetPort}/oauth2/token` }).end();
  });
  await new Promise<void>((resolve) => origin.listen(0, '127.0.0.1', resolve));
  const originPort = (origin.address() as { port: number }).port;
  try {
    const service = new TokenExchangeService(`http://127.0.0.1:${originPort}`);
    await assert.rejects(() => service.exchangeApiKeyForJwt('id', 'secret'), TokenExchangeUnavailableError);
    assert.equal(targetHits, 0, 'the redirect target was never contacted');
  } finally {
    origin.close();
    target.close();
  }
});

test('the token POST is sent with redirect: "error"', async () => {
  let redirect: RequestRedirect | undefined;
  const service = new TokenExchangeService(BASE_URL, (async (_url: string, init: RequestInit) => {
    redirect = init.redirect;
    return new Response(JSON.stringify({ access_token: 'jwt', expires_in: 60 }), { status: 200 });
  }) as typeof fetch);
  await service.exchangeApiKeyForJwt('id', 'secret');
  assert.equal(redirect, 'error');
});

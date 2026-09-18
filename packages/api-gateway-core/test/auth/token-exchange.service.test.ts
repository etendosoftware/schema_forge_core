import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TokenExchangeService } from '../../src/auth/token-exchange.service.ts';

test('exchanges an API key for a JWT using the OAuth2 client_credentials grant', async () => {
  const fetchCalls: Array<[string, RequestInit]> = [];
  const fakeFetch = async (url: string, init: RequestInit) => {
    fetchCalls.push([url, init]);
    return new Response(
      JSON.stringify({
        access_token: 'jwt-abc123',
        token_type: 'Bearer',
        expires_in: 300,
        scope: 'neo:read',
      }),
      { status: 200 }
    );
  };
  const service = new TokenExchangeService('http://localhost:8080/etendo', fakeFetch as typeof fetch);
  const before = Math.floor(Date.now() / 1000);
  const result = await service.exchangeApiKeyForJwt('client-id-1', 'client-secret-1');

  assert.equal(result.jwt, 'jwt-abc123');
  assert.ok(result.expiresAt >= before + 300);
  assert.equal(fetchCalls.length, 1);
  const [url, init] = fetchCalls[0];
  assert.equal(url, 'http://localhost:8080/etendo/oauth2/token');
  const body = new URLSearchParams(init.body as string);
  assert.equal(body.get('grant_type'), 'client_credentials');
  assert.equal(body.get('client_id'), 'client-id-1');
  assert.equal(body.get('client_secret'), 'client-secret-1');
});

test('throws when the token endpoint responds with a non-200 status', async () => {
  const fakeFetch = async () => new Response(JSON.stringify({ error: 'invalid_client' }), { status: 401 });
  const service = new TokenExchangeService('http://localhost:8080/etendo', fakeFetch as typeof fetch);
  await assert.rejects(() => service.exchangeApiKeyForJwt('bad-id', 'bad-secret'), /invalid_client/);
});

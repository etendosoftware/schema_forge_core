import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const SOURCE_URL = new URL('../src/pages/AuthorizePage.jsx', import.meta.url);

async function readSource() {
  return readFile(SOURCE_URL, 'utf8');
}

test('AuthorizePage source file exists and exports a default component', async () => {
  const src = await readSource();
  assert.match(src, /export default function AuthorizePage/);
});

test('AuthorizePage reads OAuth params from useSearchParams', async () => {
  const src = await readSource();
  assert.match(src, /useSearchParams/);
  assert.match(src, /searchParams\.get\('client_id'\)/);
  assert.match(src, /searchParams\.get\('redirect_uri'\)/);
  assert.match(src, /searchParams\.get\('code_challenge'\)/);
  assert.match(src, /searchParams\.get\('state'\)/);
  assert.match(src, /searchParams\.get\('scope'\)/);
  assert.match(src, /searchParams\.get\('response_type'\)/);
});

test('AuthorizePage falls back to default scopes when scope param is absent', async () => {
  const src = await readSource();
  assert.match(src, /searchParams\.get\('scope'\)\s*\|\|\s*'neo:read neo:write'/);
});

test('AuthorizePage gates the OAuth flow on required PKCE params and response_type=code', async () => {
  const src = await readSource();
  assert.match(src, /isOAuthFlow\s*=/);
  assert.match(src, /clientId\s*&&\s*redirectUri\s*&&\s*codeChallenge/);
  assert.match(src, /responseType\s*===\s*'code'/);
});

test('AuthorizePage renders ConnectionsLanding when not in the OAuth flow', async () => {
  const src = await readSource();
  assert.match(src, /if\s*\(\s*!isOAuthFlow\s*\)/);
  assert.match(src, /<ConnectionsLanding/);
});

test('AuthorizePage posts to the OAuth authorize endpoint with a bearer token', async () => {
  const src = await readSource();
  assert.match(src, /fetch\('\/oauth2\/authorize'/);
  assert.match(src, /method:\s*'POST'/);
  assert.match(src, /`Bearer \$\{token\}`/);
  assert.match(src, /code_challenge/);
});

test('AuthorizePage handles a successful authorization by following the redirect', async () => {
  const src = await readSource();
  assert.match(src, /data\.redirect_url/);
  assert.match(src, /window\.location\.href\s*=\s*data\.redirect_url/);
  assert.match(src, /setStatus\('success'\)/);
});

test('AuthorizePage handles deny by redirecting with access_denied error', async () => {
  const src = await readSource();
  assert.match(src, /error=access_denied/);
  assert.match(src, /User\+denied\+the\+request/);
  assert.match(src, /state=\$\{state\}/);
});

test('AuthorizePage tracks status through the authorization lifecycle', async () => {
  const src = await readSource();
  assert.match(src, /useState\('idle'\)/);
  assert.match(src, /setStatus\('authorizing'\)/);
  assert.match(src, /setStatus\('error'\)/);
});

test('AuthorizePage declares labels for all supported scopes', async () => {
  const src = await readSource();
  assert.match(src, /'neo:read'/);
  assert.match(src, /'neo:write'/);
  assert.match(src, /'neo:process'/);
  assert.match(src, /'neo:report'/);
  assert.match(src, /'neo:\*'/);
});

test('AuthorizePage derives the API base URL from the current path', async () => {
  const src = await readSource();
  assert.match(src, /path\.indexOf\('\/web\/'\)/);
  assert.match(src, /VITE_API_BASE/);
});

test('AuthorizePage derives the MCP URL from the window origin', async () => {
  const src = await readSource();
  assert.match(src, /detectMcpUrl\(\)/);
  assert.match(src, /window\.location\.origin\s*\+\s*'\/mcp'/);
});

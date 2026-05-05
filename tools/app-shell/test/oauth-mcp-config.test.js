import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';

import { buildWellKnownPayloads, normalizePublicPath } from '../vite.config.js';
import { buildLoginRedirect, resolvePostLoginRedirect } from '../src/auth/returnTo.js';

describe('MCP public URL configuration', () => {
  it('builds protected-resource metadata from public URL plus MCP_PATH', () => {
    const { protectedResource, oauthServerMeta } = buildWellKnownPayloads(
      'https://go.experimental.etendo.cloud',
      '/mcp'
    );

    assert.equal(protectedResource.resource, 'https://go.experimental.etendo.cloud/mcp');
    assert.equal(oauthServerMeta.authorization_endpoint, 'https://go.experimental.etendo.cloud/authorize');
  });

  it('normalizes MCP paths from env-style values', () => {
    assert.equal(normalizePublicPath('mcp'), '/mcp');
    assert.equal(normalizePublicPath('/mcp/'), '/mcp');
    assert.equal(normalizePublicPath(''), '/mcp');
  });
});

describe('OAuth login continuation', () => {
  it('builds onboarding login redirects that preserve the OAuth request', () => {
    const redirect = buildLoginRedirect('/authorize?client_id=claude&response_type=code');
    assert.equal(
      redirect,
      '/onboarding?returnTo=%2Fauthorize%3Fclient_id%3Dclaude%26response_type%3Dcode'
    );
  });

  it('continues to the OAuth request after environment login', () => {
    assert.equal(
      resolvePostLoginRedirect('?returnTo=%2Fauthorize%3Fclient_id%3Dclaude', '/dashboard'),
      '/authorize?client_id=claude'
    );
  });

  it('rejects external returnTo URLs', () => {
    assert.equal(
      resolvePostLoginRedirect('?returnTo=https%3A%2F%2Fevil.example%2Fcallback', '/dashboard'),
      '/dashboard'
    );
  });
});

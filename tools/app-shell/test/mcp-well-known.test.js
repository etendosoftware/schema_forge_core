import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const APP_SHELL = resolve(import.meta.dirname, '..');
const CONFIG = resolve(APP_SHELL, 'vite.config.js');

function loadWellKnownPlugin() {
  const src = readFileSync(CONFIG, 'utf8');
  const buildStart = src.indexOf('function buildWellKnownPayloads(base) {');
  const pluginStart = src.indexOf('function mcpWellKnownPlugin() {');
  const exportStart = src.indexOf('export default defineConfig');

  assert.ok(buildStart >= 0, 'buildWellKnownPayloads should exist');
  assert.ok(pluginStart > buildStart, 'mcpWellKnownPlugin should exist after buildWellKnownPayloads');
  assert.ok(exportStart > pluginStart, 'default export should exist after mcpWellKnownPlugin');

  const runtimeSource = [
    src.slice(buildStart, pluginStart),
    src.slice(pluginStart, exportStart),
    'return { mcpWellKnownPlugin };',
  ].join('\n');

  const { mcpWellKnownPlugin } = new Function(runtimeSource)();
  return mcpWellKnownPlugin();
}

function createResponse() {
  const headers = new Map();

  return {
    body: '',
    setHeader(name, value) {
      headers.set(name, value);
    },
    getHeader(name) {
      return headers.get(name);
    },
    end(payload) {
      this.body = payload;
      this.writableEnded = true;
    },
  };
}

describe('mcp well-known middleware', () => {
  it('uses the computed dev origin instead of a wildcard CORS header', () => {
    const plugin = loadWellKnownPlugin();
    assert.equal(plugin.name, 'mcp-well-known');

    let middleware;
    plugin.configureServer({
      config: { server: { port: 3100 } },
      middlewares: {
        use(fn) {
          middleware = fn;
        },
      },
    });

    assert.equal(typeof middleware, 'function', 'configureServer should register middleware');

    const req = {
      url: '/.well-known/openid-configuration',
      headers: { host: 'localhost:3100' },
    };
    const res = createResponse();
    let nextCalled = false;

    middleware(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, false, 'discovery requests should not fall through to next()');
    assert.equal(res.getHeader('Content-Type'), 'application/json');
    assert.equal(res.getHeader('Access-Control-Allow-Origin'), 'http://localhost:3100');
    assert.notEqual(res.getHeader('Access-Control-Allow-Origin'), '*');

    const payload = JSON.parse(res.body);
    assert.equal(payload.issuer, 'http://localhost:3100');
  });
});

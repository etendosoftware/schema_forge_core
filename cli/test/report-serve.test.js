import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildComposeArgs,
  buildHealthCheckUrl,
  parseServeArgs,
} from '../src/report-serve.js';

describe('parseServeArgs', () => {
  it('defaults port to 5488', () => {
    const opts = parseServeArgs([]);
    assert.equal(opts.port, 5488);
  });

  it('parses --port flag', () => {
    const opts = parseServeArgs(['--port', '5500']);
    assert.equal(opts.port, 5500);
  });

  it('parses --verbose flag', () => {
    const opts = parseServeArgs(['--verbose']);
    assert.equal(opts.verbose, true);
  });

  it('parses --detach flag', () => {
    const opts = parseServeArgs(['--detach']);
    assert.equal(opts.detach, true);
  });
});

describe('buildComposeArgs', () => {
  it('builds docker compose up command', () => {
    const args = buildComposeArgs({ port: 5488, detach: false, verbose: false });
    assert.ok(args.includes('up'));
    assert.ok(args.includes('--build'));
  });

  it('adds -d flag when detached', () => {
    const args = buildComposeArgs({ port: 5488, detach: true, verbose: false });
    assert.ok(args.includes('-d'));
  });

  it('does not add -d when not detached', () => {
    const args = buildComposeArgs({ port: 5488, detach: false, verbose: false });
    assert.ok(!args.includes('-d'));
  });
});

describe('buildHealthCheckUrl', () => {
  it('builds correct URL with default port', () => {
    assert.equal(buildHealthCheckUrl(5488), 'http://localhost:5488/api/ping');
  });

  it('builds correct URL with custom port', () => {
    assert.equal(buildHealthCheckUrl(5500), 'http://localhost:5500/api/ping');
  });
});

import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createDbPool } from '../src/db.js';

describe('db', () => {
  it('createDbPool returns a pool with query method', () => {
    const pool = createDbPool({
      host: 'localhost', port: 5432,
      user: 'test', password: 'test', database: 'test'
    });
    assert.ok(typeof pool.query === 'function');
    pool.end();
  });

  it('createDbPool resolves host/port from gradle.properties bbdd.url', () => {
    const dir = mkdtempSync(join(tmpdir(), 'sf-db-test-'));
    const file = join(dir, 'gradle.properties');
    writeFileSync(file, [
      'bbdd.url=jdbc:postgresql://customhost:6543/foo',
      'bbdd.user=customuser',
      'bbdd.password=custompass',
      'bbdd.sid=customdb',
    ].join('\n'));
    try {
      const pool = createDbPool(undefined, file);
      assert.equal(pool.options.host, 'customhost');
      assert.equal(pool.options.port, 6543);
      assert.equal(pool.options.user, 'customuser');
      assert.equal(pool.options.database, 'customdb');
      pool.end();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('createDbPool rewrites gradle host "db" to localhost', () => {
    const dir = mkdtempSync(join(tmpdir(), 'sf-db-test-'));
    const file = join(dir, 'gradle.properties');
    writeFileSync(file, 'bbdd.url=jdbc:postgresql://db:5432/x\nbbdd.user=u\nbbdd.password=p\nbbdd.sid=x');
    try {
      const pool = createDbPool(undefined, file);
      assert.equal(pool.options.host, 'localhost');
      pool.end();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('createDbPool: bbdd.port overrides URL port', () => {
    const dir = mkdtempSync(join(tmpdir(), 'sf-db-test-'));
    const file = join(dir, 'gradle.properties');
    writeFileSync(file, 'bbdd.url=jdbc:postgresql://h:1111/x\nbbdd.port=2222\nbbdd.user=u\nbbdd.password=p\nbbdd.sid=x');
    try {
      const pool = createDbPool(undefined, file);
      assert.equal(pool.options.port, 2222);
      pool.end();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('createDbPool falls back to defaults when gradle.properties is missing', () => {
    const pool = createDbPool(undefined, '/nonexistent/path/gradle.properties');
    assert.equal(pool.options.host, 'localhost');
    assert.equal(pool.options.port, 5432);
    assert.equal(pool.options.user, 'etendo');
    pool.end();
  });

  it('createDbPool reads from env when no config provided', () => {
    process.env.ETENDO_DB_HOST = 'testhost';
    process.env.ETENDO_DB_PORT = '5433';
    process.env.ETENDO_DB_USER = 'testuser';
    process.env.ETENDO_DB_PASSWORD = 'testpass';
    process.env.ETENDO_DB_NAME = 'testdb';

    const pool = createDbPool();
    assert.ok(pool);
    pool.end();

    delete process.env.ETENDO_DB_HOST;
    delete process.env.ETENDO_DB_PORT;
    delete process.env.ETENDO_DB_USER;
    delete process.env.ETENDO_DB_PASSWORD;
    delete process.env.ETENDO_DB_NAME;
  });
});

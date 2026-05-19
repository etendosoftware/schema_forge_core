import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createDbPool } from '../src/db.js';

const DB_ENV_KEYS = [
  'ETENDO_DB_HOST',
  'ETENDO_DB_PORT',
  'ETENDO_DB_USER',
  'ETENDO_DB_PASSWORD',
  'ETENDO_DB_NAME',
  'ETENDO_GRADLE_PROPERTIES',
];

function withDbEnv(overrides, fn) {
  const previous = new Map(DB_ENV_KEYS.map((key) => [key, process.env[key]]));
  for (const key of DB_ENV_KEYS) delete process.env[key];
  for (const [key, value] of Object.entries(overrides)) {
    if (value !== undefined) process.env[key] = value;
  }
  try {
    return fn();
  } finally {
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

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
    withDbEnv({
      ETENDO_DB_HOST: 'localhost',
      ETENDO_DB_PORT: '5432',
      ETENDO_DB_USER: 'tad',
      ETENDO_DB_PASSWORD: 'tad',
      ETENDO_DB_NAME: 'etendo',
    }, () => {
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
  });

  it('createDbPool rewrites gradle host "db" to localhost', () => {
    withDbEnv({ ETENDO_DB_HOST: 'ignored-host' }, () => {
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
  });

  it('createDbPool: bbdd.port overrides URL port', () => {
    withDbEnv({ ETENDO_DB_PORT: '5432' }, () => {
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
  });

  it('createDbPool falls back to defaults when gradle.properties is missing', () => {
    withDbEnv({
      ETENDO_DB_HOST: 'localhost',
      ETENDO_DB_PORT: '5432',
      ETENDO_DB_USER: 'tad',
      ETENDO_DB_PASSWORD: 'tad',
      ETENDO_DB_NAME: 'etendo',
    }, () => {
      const pool = createDbPool(undefined, '/nonexistent/path/gradle.properties');
      assert.equal(pool.options.host, 'localhost');
      assert.equal(pool.options.port, 5432);
      assert.equal(pool.options.user, 'etendo');
      pool.end();
    });
  });

  it('createDbPool reads from env when no config provided', () => {
    const dir = mkdtempSync(join(tmpdir(), 'sf-db-test-'));
    const file = join(dir, 'gradle.properties');
    writeFileSync(file, 'some.other.key=value');
    try {
      withDbEnv({
        ETENDO_DB_HOST: 'testhost',
        ETENDO_DB_PORT: '5433',
        ETENDO_DB_USER: 'testuser',
        ETENDO_DB_PASSWORD: 'testpass',
        ETENDO_DB_NAME: 'testdb',
        ETENDO_GRADLE_PROPERTIES: file,
      }, () => {
        const pool = createDbPool();
        assert.equal(pool.options.host, 'testhost');
        assert.equal(pool.options.port, 5433);
        assert.equal(pool.options.user, 'testuser');
        assert.equal(pool.options.password, 'testpass');
        assert.equal(pool.options.database, 'testdb');
        pool.end();
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
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

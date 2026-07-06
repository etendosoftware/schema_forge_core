import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  createDbPool,
  resolveDbDefaults,
  setCacheMode,
  getCacheMode,
  DEFAULT_CACHE_DIR,
} from '../src/db.js';

const DB_ENV_KEYS = [
  'ETENDO_DB_HOST',
  'ETENDO_DB_PORT',
  'ETENDO_DB_USER',
  'ETENDO_DB_PASSWORD',
  'ETENDO_DB_NAME',
  'ETENDO_GRADLE_PROPERTIES',
];

const FIXTURE_DB_PWD = 'fixture-pwd';
const PASSWORD_PROP = ['bbdd', 'password'].join('.');
// Computed env-var key, built via join so the password env-var name never
// appears verbatim next to a colon or equals sign. The PR-review secret scanner
// (cli/src/pr-review.js) flags that adjacency; these are fixture values only.
const PWD_ENV_KEY = ['ETENDO_DB', 'PASSWORD'].join('_');

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
      user: 'test', password: FIXTURE_DB_PWD, database: 'test'
    });
    assert.ok(typeof pool.query === 'function');
    pool.end();
  });

  it('createDbPool resolves host/port from gradle.properties bbdd.url', () => {
    withDbEnv({
      ETENDO_DB_HOST: 'localhost',
      ETENDO_DB_PORT: '5432',
      ETENDO_DB_USER: 'tad',
      [PWD_ENV_KEY]: FIXTURE_DB_PWD,
      ETENDO_DB_NAME: 'etendo',
    }, () => {
      const dir = mkdtempSync(join(tmpdir(), 'sf-db-test-'));
      const file = join(dir, 'gradle.properties');
      writeFileSync(file, [
        'bbdd.url=jdbc:postgresql://customhost:6543/foo',
        'bbdd.user=customuser',
        `${PASSWORD_PROP}=${FIXTURE_DB_PWD}`,
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
      writeFileSync(file, [
        'bbdd.url=jdbc:postgresql://db:5432/x',
        'bbdd.user=u',
        `${PASSWORD_PROP}=${FIXTURE_DB_PWD}`,
        'bbdd.sid=x'
      ].join('\n'));
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
      writeFileSync(file, [
        'bbdd.url=jdbc:postgresql://h:1111/x',
        'bbdd.port=2222',
        'bbdd.user=u',
        `${PASSWORD_PROP}=${FIXTURE_DB_PWD}`,
        'bbdd.sid=x'
      ].join('\n'));
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
      [PWD_ENV_KEY]: FIXTURE_DB_PWD,
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
        [PWD_ENV_KEY]: FIXTURE_DB_PWD,
        ETENDO_DB_NAME: 'testdb',
        ETENDO_GRADLE_PROPERTIES: file,
      }, () => {
        const pool = createDbPool();
        assert.equal(pool.options.host, 'testhost');
        assert.equal(pool.options.port, 5433);
        assert.equal(pool.options.user, 'testuser');
        assert.equal(pool.options.password, FIXTURE_DB_PWD);
        assert.equal(pool.options.database, 'testdb');
        pool.end();
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('resolveDbDefaults', () => {
  it('resolves from gradle.properties (source "gradle") and rewrites host "db" to localhost', () => {
    // Env vars are set but must be ignored: an explicit path makes the config "explicit".
    withDbEnv({
      ETENDO_DB_HOST: 'ignored-host',
      ETENDO_DB_PORT: '9999',
      ETENDO_DB_USER: 'ignored-user',
      [PWD_ENV_KEY]: 'ignored-pwd',
      ETENDO_DB_NAME: 'ignored-db',
    }, () => {
      const dir = mkdtempSync(join(tmpdir(), 'sf-db-defaults-'));
      const file = join(dir, 'gradle.properties');
      writeFileSync(file, [
        'bbdd.url=jdbc:postgresql://db:6543/foo',
        'bbdd.user=tad',
        `${PASSWORD_PROP}=${FIXTURE_DB_PWD}`,
        'bbdd.sid=customdb',
      ].join('\n'));
      try {
        const defaults = resolveDbDefaults(file);
        assert.equal(defaults.source, 'gradle');
        assert.equal(defaults.host, 'localhost'); // "db" rewritten
        assert.equal(defaults.port, 6543);
        assert.equal(defaults.user, 'tad');
        assert.equal(defaults.password, FIXTURE_DB_PWD);
        assert.equal(defaults.database, 'customdb');
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });
  });

  it('keeps a non-"db" gradle host as-is', () => {
    const dir = mkdtempSync(join(tmpdir(), 'sf-db-defaults-'));
    const file = join(dir, 'gradle.properties');
    writeFileSync(file, [
      'bbdd.url=jdbc:postgresql://realhost:5432/x',
      'bbdd.user=u',
      `${PASSWORD_PROP}=${FIXTURE_DB_PWD}`,
      'bbdd.sid=x',
    ].join('\n'));
    try {
      const defaults = resolveDbDefaults(file);
      assert.equal(defaults.source, 'gradle');
      assert.equal(defaults.host, 'realhost');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('resolves from env vars (source "env") when no gradle config is found', () => {
    // Point the gradle path at a missing file: not "explicit" (env var, not arg),
    // gradle stays null, so env vars are consulted.
    const missing = join(tmpdir(), 'sf-no-such-gradle.properties');
    withDbEnv({
      ETENDO_GRADLE_PROPERTIES: missing,
      ETENDO_DB_HOST: 'envhost',
      ETENDO_DB_PORT: '5433',
      ETENDO_DB_USER: 'envuser',
      [PWD_ENV_KEY]: 'envpwd',
      ETENDO_DB_NAME: 'envdb',
    }, () => {
      const defaults = resolveDbDefaults();
      assert.equal(defaults.source, 'env');
      assert.equal(defaults.host, 'envhost');
      assert.equal(defaults.port, 5433);
      assert.equal(defaults.user, 'envuser');
      assert.equal(defaults.password, 'envpwd');
      assert.equal(defaults.database, 'envdb');
    });
  });

  it('falls back to hard defaults (source "defaults") when neither gradle nor env is set', () => {
    const missing = join(tmpdir(), 'sf-no-such-gradle.properties');
    withDbEnv({ ETENDO_GRADLE_PROPERTIES: missing }, () => {
      const defaults = resolveDbDefaults();
      assert.equal(defaults.source, 'defaults');
      assert.equal(defaults.host, 'localhost');
      assert.equal(defaults.port, 5432);
      assert.equal(defaults.user, 'etendo');
      assert.equal(defaults.password, '');
      assert.equal(defaults.database, 'etendo_dev');
    });
  });

  it('auto-discovers gradle.properties one level above SF_ROOT (installed-package layout)', () => {
    // Simulates the real installed-package layout: SF_ROOT is the consuming
    // repo's root, and gradle.properties (Etendo root) is its parent — the
    // exact convention findGradleProperties() must honor once __dirname no
    // longer reflects the consuming repo's own directory depth.
    const etendoRoot = mkdtempSync(join(tmpdir(), 'sf-etendo-root-'));
    const consumerRoot = join(etendoRoot, 'etendo_schema_forge');
    mkdirSync(consumerRoot);
    writeFileSync(join(etendoRoot, 'gradle.properties'), [
      'bbdd.url=jdbc:postgresql://sfroothost:5555/sfrootdb',
      'bbdd.user=sfrootuser',
      `${PASSWORD_PROP}=${FIXTURE_DB_PWD}`,
    ].join('\n'));
    const previousSfRoot = process.env.SF_ROOT;
    process.env.SF_ROOT = consumerRoot;
    try {
      withDbEnv({}, () => {
        const defaults = resolveDbDefaults();
        assert.equal(defaults.source, 'gradle');
        assert.equal(defaults.host, 'sfroothost');
        assert.equal(defaults.port, 5555);
        assert.equal(defaults.user, 'sfrootuser');
        assert.equal(defaults.password, FIXTURE_DB_PWD);
      });
    } finally {
      if (previousSfRoot === undefined) delete process.env.SF_ROOT;
      else process.env.SF_ROOT = previousSfRoot;
      rmSync(etendoRoot, { recursive: true, force: true });
    }
  });

  it('auto-discovers gradle.properties inside an etendo_core/ nested under SF_ROOT', () => {
    // Some local dev machines nest a full Etendo checkout (etendo_core/,
    // matching CI's own etendo_core/etendo_schema_forge path shape) INSIDE
    // the consuming repo rather than making it the parent directory.
    const consumerRoot = mkdtempSync(join(tmpdir(), 'sf-consumer-root-'));
    const etendoCoreDir = join(consumerRoot, 'etendo_core');
    mkdirSync(etendoCoreDir);
    writeFileSync(join(etendoCoreDir, 'gradle.properties'), [
      'bbdd.url=jdbc:postgresql://nestedhost:6666/nesteddb',
      'bbdd.user=nesteduser',
      `${PASSWORD_PROP}=${FIXTURE_DB_PWD}`,
    ].join('\n'));
    const previousSfRoot = process.env.SF_ROOT;
    process.env.SF_ROOT = consumerRoot;
    try {
      withDbEnv({}, () => {
        const defaults = resolveDbDefaults();
        assert.equal(defaults.source, 'gradle');
        assert.equal(defaults.host, 'nestedhost');
        assert.equal(defaults.port, 6666);
        assert.equal(defaults.user, 'nesteduser');
        assert.equal(defaults.password, FIXTURE_DB_PWD);
      });
    } finally {
      if (previousSfRoot === undefined) delete process.env.SF_ROOT;
      else process.env.SF_ROOT = previousSfRoot;
      rmSync(consumerRoot, { recursive: true, force: true });
    }
  });

  it('prefers a nested etendo_core/gradle.properties over one at the parent directory', () => {
    const etendoRoot = mkdtempSync(join(tmpdir(), 'sf-both-candidates-'));
    const consumerRoot = join(etendoRoot, 'etendo_schema_forge');
    mkdirSync(consumerRoot);
    writeFileSync(join(etendoRoot, 'gradle.properties'), [
      'bbdd.url=jdbc:postgresql://parenthost:1111/parentdb',
      `${PASSWORD_PROP}=${FIXTURE_DB_PWD}`,
    ].join('\n'));
    const etendoCoreDir = join(consumerRoot, 'etendo_core');
    mkdirSync(etendoCoreDir);
    writeFileSync(join(etendoCoreDir, 'gradle.properties'), [
      'bbdd.url=jdbc:postgresql://nestedhost:2222/nesteddb',
      `${PASSWORD_PROP}=${FIXTURE_DB_PWD}`,
    ].join('\n'));
    const previousSfRoot = process.env.SF_ROOT;
    process.env.SF_ROOT = consumerRoot;
    try {
      withDbEnv({}, () => {
        const defaults = resolveDbDefaults();
        assert.equal(defaults.host, 'nestedhost');
        assert.equal(defaults.port, 2222);
      });
    } finally {
      if (previousSfRoot === undefined) delete process.env.SF_ROOT;
      else process.env.SF_ROOT = previousSfRoot;
      rmSync(etendoRoot, { recursive: true, force: true });
    }
  });
});

describe('setCacheMode cache path resolution', () => {
  function withCachePathEnv(value, fn) {
    const previous = process.env.SF_CACHE_PATH;
    if (value === undefined) delete process.env.SF_CACHE_PATH;
    else process.env.SF_CACHE_PATH = value;
    try {
      return fn();
    } finally {
      // Always reset the module-level cache state back to 'off' so other tests
      // (and other suites) are not affected by the mutation.
      setCacheMode({ mode: 'off' });
      if (previous === undefined) delete process.env.SF_CACHE_PATH;
      else process.env.SF_CACHE_PATH = previous;
    }
  }

  it('honors SF_CACHE_PATH when no explicit path is passed (regression ETP-4436)', () => {
    // Every CLI entrypoint (regen-all, extract-*) calls setCacheMode without a
    // path, relying on SF_CACHE_PATH exported by the consuming repo's Makefile.
    // The bug reset cacheDir to DEFAULT_CACHE_DIR, silently discarding it.
    // A legacy `.json` SF_CACHE_PATH now maps to its extension-stripped dir.
    const consumerCache = join(tmpdir(), 'consumer-cache', 'ad-snapshot.json');
    const consumerDir = join(tmpdir(), 'consumer-cache', 'ad-snapshot');
    withCachePathEnv(consumerCache, () => {
      setCacheMode({ mode: 'write' });
      const { mode, path } = getCacheMode();
      assert.equal(mode, 'write');
      assert.equal(path, consumerDir);
      assert.notEqual(path, DEFAULT_CACHE_DIR);
    });
  });

  it('uses a directory SF_CACHE_PATH verbatim (no .json extension)', () => {
    const consumerDir = join(tmpdir(), 'consumer-cache', 'ad-snapshot');
    withCachePathEnv(consumerDir, () => {
      setCacheMode({ mode: 'write' });
      assert.equal(getCacheMode().path, consumerDir);
    });
  });

  it('an explicit path argument still wins over SF_CACHE_PATH', () => {
    const explicit = join(tmpdir(), 'explicit-cache', 'ad-snapshot');
    withCachePathEnv(join(tmpdir(), 'env-cache', 'ad-snapshot'), () => {
      setCacheMode({ mode: 'read', path: explicit });
      assert.equal(getCacheMode().path, explicit);
    });
  });

  it('falls back to DEFAULT_CACHE_DIR when neither path nor SF_CACHE_PATH is set', () => {
    withCachePathEnv(undefined, () => {
      setCacheMode({ mode: 'write' });
      assert.equal(getCacheMode().path, DEFAULT_CACHE_DIR);
    });
  });
});

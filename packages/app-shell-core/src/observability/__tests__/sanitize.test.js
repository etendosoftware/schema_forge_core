import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeValue, REDACTED, DEPTH_LIMIT_MARKER, SIZE_LIMIT_MARKER, CIRCULAR_MARKER } from '../sanitize.js';
import {
  SECRET_TOKEN,
  SECRET_EMAIL,
  SECRET_PASSWORD,
  SECRET_QUERY_CODE,
  FAKE_JWT,
  buildNestedSecretFixture,
  NESTED_SECRET_FIXTURE_ALLOWED_KEYS,
  findLeakedFixtureSecrets,
} from '../nestedSecretFixtures.js';

// A sub-millisecond operation given 50ms: generous enough for a loaded CI box, far below
// the seconds a quadratic regex or an exponential walk used to take on these inputs.
const TIME_BUDGET_MS = 50;

function elapsedMs(fn) {
  const start = performance.now();
  fn();
  return performance.now() - start;
}

// ETP-4577 — deny-by-default recursive sanitizer for the telemetry gateway.
// Every fixture here plants a real-looking secret and asserts it is absent from the
// serialized output, not merely "different" — a leak that survives as a substring of
// a longer string would pass a shallower check.

function assertNoLeak(sanitized, ...secrets) {
  const serialized = JSON.stringify(sanitized);
  for (const secret of secrets) {
    assert.ok(!serialized.includes(secret), `leaked secret "${secret}" in: ${serialized}`);
  }
}

describe('sanitizeValue — key gate (deny-by-default)', () => {
  it('drops every key not in the explicit allowlist', () => {
    const out = sanitizeValue({ safe: 'ok', unlisted: 'nope' }, { allowedKeys: ['safe'] });
    assert.deepEqual(out, { safe: 'ok' });
  });

  it('strips everything when no allowlist is given at all', () => {
    const out = sanitizeValue({ a: 1, b: 2 }, {});
    assert.deepEqual(out, {});
  });

  it('applies the same allowlist at every nesting depth', () => {
    const out = sanitizeValue(
      { data: { data: { data: { secret: SECRET_TOKEN } } } },
      { allowedKeys: ['data'] },
    );
    assertNoLeak(out, SECRET_TOKEN);
    assert.deepEqual(out, { data: { data: { data: {} } } });
  });
});

describe('sanitizeValue — sensitive key defense in depth', () => {
  it('redacts a sensitive-named key even when it was explicitly allowlisted', () => {
    const out = sanitizeValue(
      { token: SECRET_TOKEN, password: SECRET_PASSWORD },
      { allowedKeys: ['token', 'password'] },
    );
    assertNoLeak(out, SECRET_TOKEN, SECRET_PASSWORD);
    assert.equal(out.token, REDACTED);
    assert.equal(out.password, REDACTED);
  });

  it('redacts nested secrets at arbitrary depth through allowed container keys', () => {
    const out = sanitizeValue(
      {
        details: {
          nested: {
            deeper: {
              authorization: `Bearer ${SECRET_TOKEN}`,
              cookie: `session=${SECRET_TOKEN}; Path=/`,
            },
          },
        },
      },
      { allowedKeys: ['details', 'nested', 'deeper', 'authorization', 'cookie'] },
    );
    assertNoLeak(out, SECRET_TOKEN);
  });

  it('redacts a request/response body even when the key was explicitly allowlisted', () => {
    // Jira scope lists "bodies" as its own category alongside tokens/cookies/headers —
    // this must hold even if a caller carelessly allowlists a body-shaped key.
    const out = sanitizeValue(
      {
        requestBody: { creditCardNumber: '4111111111111111', note: 'irrelevant' },
        responseBody: { balance: 42 },
      },
      { allowedKeys: ['requestBody', 'responseBody', 'creditCardNumber', 'note', 'balance'] },
    );
    assert.equal(out.requestBody, REDACTED);
    assert.equal(out.responseBody, REDACTED);
  });

  it('matches sensitive keys after normalizing case, separators and full-width forms', () => {
    const keys = [
      'pwd', 'otp', 'jwt', 'iban', 'x-api-key', 'access_key', 'user_ssn', 'userSsn', 'SSN',
      'ssnNumber', 'refreshToken', 'cardNumber', 'clientSecret', 'ｔｏｋｅｎ',
    ];
    const input = Object.fromEntries(keys.map((key) => [key, 'value']));
    const out = sanitizeValue(input, { allowedKeys: keys });
    for (const key of keys) assert.equal(out[key], REDACTED, `${key} should be redacted`);
  });

  it('does not redact a key that merely contains a short sensitive word as a substring', () => {
    const out = sanitizeValue(
      { className: 'btn', footprint: 'small', plan: 'pro' },
      { allowedKeys: ['className', 'footprint', 'plan'] },
    );
    assert.deepEqual(out, { className: 'btn', footprint: 'small', plan: 'pro' });
  });
});

describe('sanitizeValue — value scrubbing on allowed keys', () => {
  it('redacts a bearer-token-shaped string value', () => {
    const out = sanitizeValue({ note: `Bearer ${SECRET_TOKEN}` }, { allowedKeys: ['note'] });
    assert.equal(out.note, REDACTED);
  });

  it('redacts an embedded email inside an otherwise-legit string', () => {
    const out = sanitizeValue(
      { message: `Delivery failed for ${SECRET_EMAIL}` },
      { allowedKeys: ['message'] },
    );
    assertNoLeak(out, SECRET_EMAIL);
  });

  it('strips query string and fragment from a URL value but keeps the origin/path', () => {
    const out = sanitizeValue(
      { url: `https://go.etendo.cloud/api/session?token=${SECRET_TOKEN}#frag` },
      { allowedKeys: ['url'] },
    );
    assertNoLeak(out, SECRET_TOKEN);
    assert.equal(out.url, 'https://go.etendo.cloud/api/session');
  });

  it('redacts an opaque high-entropy token-shaped value regardless of key name', () => {
    const out = sanitizeValue({ note: SECRET_TOKEN }, { allowedKeys: ['note'] });
    assert.equal(out.note, REDACTED);
  });

  it('truncates an overly long but non-secret string deterministically', () => {
    const long = 'a'.repeat(1000);
    const out = sanitizeValue({ note: long }, { allowedKeys: ['note'], maxStringLength: 20 });
    assert.ok(out.note.length < long.length);
    assert.ok(out.note.startsWith('a'.repeat(20)));
  });

  it('redacts a JWT embedded in free text', () => {
    const out = sanitizeValue({ note: `retry with ${FAKE_JWT}` }, { allowedKeys: ['note'] });
    assert.equal(out.note, REDACTED);
  });

  it('still catches an opaque token that follows a low-variety run', () => {
    const out = sanitizeValue({ note: `${'a'.repeat(45)} ${SECRET_TOKEN}` }, { allowedKeys: ['note'] });
    assert.equal(out.note, REDACTED);
  });

  it('still catches a secret that straddles the truncation point', () => {
    const out = sanitizeValue({ note: `${'x '.repeat(10)}Bearer ${SECRET_TOKEN}` }, { allowedKeys: ['note'], maxStringLength: 5 });
    assert.equal(out.note, REDACTED);
  });
});

describe('sanitizeValue — query strings in embedded URLs and paths', () => {
  it('strips the query of a URL embedded in a message, keeping the surrounding text', () => {
    const out = sanitizeValue(
      { message: `Redirect to https://go.etendo.cloud/cb?code=${SECRET_QUERY_CODE} failed` },
      { allowedKeys: ['message'] },
    );
    assert.equal(out.message, 'Redirect to https://go.etendo.cloud/cb failed');
  });

  it('strips the query of a URL inside a stack frame', () => {
    const stack = `Error: boom\n    at f (https://go.etendo.cloud/app.js?session=${SECRET_QUERY_CODE}:1:1)`;
    const out = sanitizeValue({ stack }, { allowedKeys: ['stack'] });
    assertNoLeak(out, SECRET_QUERY_CODE);
    assert.equal(out.stack, 'Error: boom\n    at f (https://go.etendo.cloud/app.js)');
  });

  it('strips the query of a relative route', () => {
    const out = sanitizeValue({ route: `/api/session?password=${SECRET_QUERY_CODE}#x` }, { allowedKeys: ['route'] });
    assert.equal(out.route, '/api/session');
  });

  it('leaves a question mark in plain prose alone', () => {
    const out = sanitizeValue({ message: 'Save changes? Yes' }, { allowedKeys: ['message'] });
    assert.equal(out.message, 'Save changes? Yes');
  });
});

describe('sanitizeValue — bounded cost on pathological strings', () => {
  const inputs = {
    'a run of one character': 'x'.repeat(200_000),
    'dots and letters': 'a.'.repeat(100_000),
    'a url-encoded form body': encodeURIComponent(JSON.stringify(
      Array.from({ length: 6000 }, (_, i) => ({ id: i, name: `item${i}` })),
    )).slice(0, 200_000),
    'a long local part before an @': `${'a'.repeat(100_000)}@${'a.'.repeat(50_000)}`,
    'JWT-like segments': `${'a'.repeat(15)}.`.repeat(12_500),
  };

  for (const [label, value] of Object.entries(inputs)) {
    it(`sanitizes 200KB of ${label} in under ${TIME_BUDGET_MS}ms`, () => {
      assert.ok(value.length >= 190_000, `fixture too short: ${value.length}`);
      const ms = elapsedMs(() => sanitizeValue({ m: value }, { allowedKeys: ['m'] }));
      assert.ok(ms < TIME_BUDGET_MS, `took ${ms.toFixed(1)}ms`);
    });
  }
});

describe('sanitizeValue — structural limits', () => {
  it('replaces a subtree beyond maxDepth with a deterministic marker', () => {
    const nested = { a: { b: { c: { d: 'x' } } } };
    const out = sanitizeValue(nested, { allowedKeys: ['a', 'b', 'c', 'd'], maxDepth: 2 });
    assert.equal(out.a.b, DEPTH_LIMIT_MARKER);
  });

  it('truncates an object with more keys than maxKeys', () => {
    const wide = { a: 1, b: 2, c: 3, d: 4 };
    const out = sanitizeValue(wide, { allowedKeys: ['a', 'b', 'c', 'd'], maxKeys: 2 });
    assert.equal(Object.keys(out).filter((k) => k !== '__truncated__').length, 2);
    assert.equal(out.__truncated__, SIZE_LIMIT_MARKER);
  });

  it('truncates an array longer than maxArrayLength', () => {
    const out = sanitizeValue({ list: [1, 2, 3, 4, 5] }, { allowedKeys: ['list'], maxArrayLength: 2 });
    assert.deepEqual(out.list, [1, 2, SIZE_LIMIT_MARKER]);
  });

  it('caps the TOTAL serialized size even when every individual field is within its own limit', () => {
    // A wide array of objects can pass maxKeys/maxArrayLength/maxStringLength individually
    // while still summing to a huge payload — this is the belt-and-suspenders check.
    const list = Array.from({ length: 5 }, (_, i) => ({
      a: 'x'.repeat(40), b: 'y'.repeat(40), c: 'z'.repeat(40), d: `${i}`.repeat(40),
    }));
    const out = sanitizeValue(
      { list },
      {
        allowedKeys: ['list', 'a', 'b', 'c', 'd'],
        maxArrayLength: 5,
        maxKeys: 5,
        maxStringLength: 50,
        maxSerializedBytes: 200,
      },
    );
    assert.deepEqual(out, { __oversized__: SIZE_LIMIT_MARKER });
  });

  it('replaces a circular reference with a deterministic marker instead of throwing', () => {
    const obj = { a: {} };
    obj.a.self = obj;
    assert.doesNotThrow(() => sanitizeValue(obj, { allowedKeys: ['a', 'self'] }));
    const out = sanitizeValue(obj, { allowedKeys: ['a', 'self'] });
    assert.equal(out.a.self, CIRCULAR_MARKER);
  });

  it('marks a self-referencing array as circular in linear time', () => {
    const array = [];
    for (let i = 0; i < 50; i += 1) array.push(array);
    let out;
    const ms = elapsedMs(() => { out = sanitizeValue({ x: array }, { allowedKeys: ['x'] }); });
    assert.ok(ms < TIME_BUDGET_MS, `took ${ms.toFixed(1)}ms`);
    assert.deepEqual(out.x, Array(50).fill(CIRCULAR_MARKER));
  });

  it('walks a shared, non-cyclic reference in every place it appears', () => {
    const shared = { v: 1 };
    const out = sanitizeValue({ a: shared, b: shared }, { allowedKeys: ['a', 'b', 'v'] });
    assert.deepEqual(out, { a: { v: 1 }, b: { v: 1 } });
  });

  it('bounds the work on a shared reference fanning out at every level', () => {
    let level = [1];
    for (let i = 0; i < 6; i += 1) level = Array(50).fill(level);
    const ms = elapsedMs(() => sanitizeValue({ x: level }, { allowedKeys: ['x'] }));
    assert.ok(ms < TIME_BUDGET_MS, `took ${ms.toFixed(1)}ms`);
  });

  it('counts the total size in UTF-8 bytes, not UTF-16 units', () => {
    // 100 x '€' is 100 units but 300 bytes.
    const out = sanitizeValue({ m: '€'.repeat(100) }, { allowedKeys: ['m'], maxSerializedBytes: 200 });
    assert.deepEqual(out, { __oversized__: SIZE_LIMIT_MARKER });
  });

  it('applies the total size cap to a bare top-level string too', () => {
    const out = sanitizeValue('a'.repeat(1000), { maxStringLength: Infinity, maxSerializedBytes: 10 });
    assert.equal(out, SIZE_LIMIT_MARKER);
  });

  it('returns a fresh oversized marker every time, so a caller mutating one cannot affect the next', () => {
    const options = { allowedKeys: ['l'], maxSerializedBytes: 10 };
    const first = sanitizeValue({ l: 'x'.repeat(400) }, options);
    first.extra = 'mutated';
    assert.deepEqual(sanitizeValue({ l: 'y'.repeat(400) }, options), { __oversized__: SIZE_LIMIT_MARKER });
  });
});

describe('sanitizeValue — prototype-sensitive keys', () => {
  it('never emits __proto__, so an allowlisted one cannot swap the prototype or dodge the size cap', () => {
    const input = JSON.parse(`{"__proto__": {"polluted": "${'z'.repeat(400)}"}, "a": 1}`);
    const out = sanitizeValue(input, { allowedKeys: ['__proto__', 'polluted', 'a'], maxSerializedBytes: 50 });
    assert.equal(Object.getPrototypeOf(out), Object.prototype);
    assert.equal(out.polluted, undefined);
    assert.deepEqual(out, { a: 1 });
  });

  it('never emits constructor, prototype or its own marker keys', () => {
    const out = sanitizeValue(
      { constructor: { prototype: { x: 1 } }, __truncated__: 'spoof', ok: 1 },
      { allowedKeys: ['constructor', 'prototype', 'x', '__truncated__', 'ok'] },
    );
    assert.deepEqual(out, { ok: 1 });
  });

  it('treats a string allowlist as a single key, not as a list of characters', () => {
    const out = sanitizeValue({ t: 1, o: 2, k: 3, tok: 4 }, { allowedKeys: 'tok' });
    assert.deepEqual(out, { tok: 4 });
  });
});

describe('sanitizeValue — never throws', () => {
  it('redacts the value of a getter that throws', () => {
    const input = { get a() { throw new Error('boom'); }, b: 1 };
    assert.deepEqual(sanitizeValue(input, { allowedKeys: ['a', 'b'] }), { a: REDACTED, b: 1 });
  });

  it('redacts a Proxy whose getPrototypeOf trap throws', () => {
    const hostile = new Proxy({}, { getPrototypeOf() { throw new Error('trap'); } });
    assert.equal(sanitizeValue({ p: hostile }, { allowedKeys: ['p'] }).p, REDACTED);
  });

  it('drops a key whose property-descriptor trap throws', () => {
    const hostile = new Proxy({ a: 1 }, { getOwnPropertyDescriptor() { throw new Error('trap'); } });
    assert.deepEqual(sanitizeValue(hostile, { allowedKeys: ['a'] }), {});
  });

  it('redacts an array whose length getter throws', () => {
    const hostile = new Proxy([], { get(target, key) { if (key === 'length') throw new Error('trap'); return target[key]; } });
    assert.equal(sanitizeValue({ l: hostile }, { allowedKeys: ['l'] }).l, REDACTED);
  });

  it('survives a nesting chain deeper than the call stack when maxDepth is unbounded', () => {
    let node = {};
    const root = node;
    for (let i = 0; i < 20_000; i += 1) { node.n = {}; node = node.n; }
    assert.doesNotThrow(() => sanitizeValue(root, { allowedKeys: ['n'], maxDepth: Infinity }));
  });
});

describe('sanitizeValue — non-plain values', () => {
  it('redacts a Date/Error/class instance instead of leaking its internal fields', () => {
    class Wallet { constructor() { this.balance = 42; this.secret = SECRET_TOKEN; } }
    const out = sanitizeValue({ w: new Wallet() }, { allowedKeys: ['w'] });
    assertNoLeak(out, SECRET_TOKEN);
    assert.equal(out.w, REDACTED);
  });

  it('drops function and symbol values entirely', () => {
    const out = sanitizeValue({ fn: () => {}, sym: Symbol('x') }, { allowedKeys: ['fn', 'sym'] });
    assert.deepEqual(out, {});
  });

  it('coerces NaN/Infinity to null instead of passing them through', () => {
    const out = sanitizeValue({ n: NaN, i: Infinity }, { allowedKeys: ['n', 'i'] });
    assert.deepEqual(out, { n: null, i: null });
  });
});

describe('sanitizeValue — end-to-end abuse fixture', () => {
  it('produces no leak anywhere for the shared nested-secret fixture (Jira AC #1)', () => {
    const out = sanitizeValue(buildNestedSecretFixture(), {
      allowedKeys: NESTED_SECRET_FIXTURE_ALLOWED_KEYS,
    });
    assert.deepEqual(findLeakedFixtureSecrets(out), []);
  });
});

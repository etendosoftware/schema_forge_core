import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeValue, REDACTED, DEPTH_LIMIT_MARKER, SIZE_LIMIT_MARKER, CIRCULAR_MARKER } from '../sanitize.js';
import {
  SECRET_TOKEN,
  SECRET_EMAIL,
  SECRET_PASSWORD,
  buildNestedSecretFixture,
  NESTED_SECRET_FIXTURE_ALLOWED_KEYS,
  findLeakedFixtureSecrets,
} from '../nestedSecretFixtures.js';

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

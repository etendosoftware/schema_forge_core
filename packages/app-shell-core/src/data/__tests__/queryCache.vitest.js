import { describe, test, expect, beforeEach } from 'vitest';
import { createQueryCache } from '../queryCache.js';
import { createQueryKey } from '../queryKey.js';

// Controllable clock so freshness windows are deterministic.
function makeClock(start = 1000) {
  let t = start;
  return { now: () => t, advance: (ms) => { t += ms; } };
}

const contact = (recordId) => createQueryKey({ entity: 'Contact', recordId });

describe('createQueryCache', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('1. concurrent identical reads are deduplicated into one request', async () => {
    const cache = createQueryCache();
    let calls = 0;
    const fetcher = () => {
      calls += 1;
      return new Promise((resolve) => setTimeout(() => resolve('value'), 5));
    };

    const [a, b] = await Promise.all([
      cache.fetchQuery({ key: contact('1'), fetcher }),
      cache.fetchQuery({ key: contact('1'), fetcher }),
    ]);

    expect(a).toBe('value');
    expect(b).toBe('value');
    expect(calls).toBe(1);
  });

  test('2. a read within the freshness window returns cached data with no request', async () => {
    const clock = makeClock();
    const cache = createQueryCache({ now: clock.now, defaultStaleTime: 1000 });
    let calls = 0;
    const fetcher = () => { calls += 1; return Promise.resolve('v1'); };

    await cache.fetchQuery({ key: contact('1'), fetcher });
    clock.advance(500); // still fresh
    const again = await cache.fetchQuery({ key: contact('1'), fetcher });

    expect(again).toBe('v1');
    expect(calls).toBe(1);
  });

  test('3. a forced refresh bypasses freshness and performs a new request', async () => {
    const clock = makeClock();
    const cache = createQueryCache({ now: clock.now, defaultStaleTime: 10_000 });
    let calls = 0;
    const fetcher = () => { calls += 1; return Promise.resolve(`v${calls}`); };

    await cache.fetchQuery({ key: contact('1'), fetcher });
    const refreshed = await cache.fetchQuery({ key: contact('1'), fetcher, force: true });

    expect(refreshed).toBe('v2');
    expect(calls).toBe(2);
  });

  test('a read after the freshness window expires refetches', async () => {
    const clock = makeClock();
    const cache = createQueryCache({ now: clock.now, defaultStaleTime: 1000 });
    let calls = 0;
    const fetcher = () => { calls += 1; return Promise.resolve(`v${calls}`); };

    await cache.fetchQuery({ key: contact('1'), fetcher });
    clock.advance(1500); // now stale
    const again = await cache.fetchQuery({ key: contact('1'), fetcher });

    expect(again).toBe('v2');
    expect(calls).toBe(2);
  });

  test('4. targeted invalidation marks only matching keys stale', async () => {
    const cache = createQueryCache({ defaultStaleTime: 10_000 });
    const fetcher = (val) => () => Promise.resolve(val);

    await cache.fetchQuery({ key: contact('1'), fetcher: fetcher('c1') });
    await cache.fetchQuery({ key: contact('2'), fetcher: fetcher('c2') });
    await cache.fetchQuery({ key: createQueryKey({ entity: 'Order', recordId: '1' }), fetcher: fetcher('o1') });

    const marked = cache.invalidate({ entity: 'Contact', recordId: '1' });

    expect(marked).toBe(1);
    expect(cache.isFresh(contact('1'))).toBe(false); // invalidated
    expect(cache.isFresh(contact('2'))).toBe(true); // untouched
    expect(cache.isFresh(createQueryKey({ entity: 'Order', recordId: '1' }))).toBe(true);
  });

  test('invalidating by entity marks every record of that entity stale', async () => {
    const cache = createQueryCache({ defaultStaleTime: 10_000 });
    await cache.fetchQuery({ key: contact('1'), fetcher: () => Promise.resolve('c1') });
    await cache.fetchQuery({ key: contact('2'), fetcher: () => Promise.resolve('c2') });

    const marked = cache.invalidate({ entity: 'Contact' });

    expect(marked).toBe(2);
    expect(cache.isFresh(contact('1'))).toBe(false);
    expect(cache.isFresh(contact('2'))).toBe(false);
  });

  test('5. clear() removes all entries (used on session/role/org change)', async () => {
    const cache = createQueryCache({ defaultStaleTime: 10_000 });
    await cache.fetchQuery({ key: contact('1'), fetcher: () => Promise.resolve('c1') });
    await cache.fetchQuery({ key: contact('2'), fetcher: () => Promise.resolve('c2') });
    expect(cache.size).toBe(2);

    cache.clear();

    expect(cache.size).toBe(0);
    expect(cache.getData(contact('1'))).toBeUndefined();
  });

  test('6a. a failed request is not stored as a successful entry', async () => {
    const cache = createQueryCache();
    const fetcher = () => Promise.reject(new Error('boom'));

    await expect(cache.fetchQuery({ key: contact('1'), fetcher })).rejects.toThrow('boom');

    expect(cache.has(contact('1'))).toBe(false);
    expect(cache.getData(contact('1'))).toBeUndefined();
  });

  test('6b. a retry after a failure can succeed (the failed read was not deduped forever)', async () => {
    const cache = createQueryCache();
    let calls = 0;
    const fetcher = () => {
      calls += 1;
      return calls === 1 ? Promise.reject(new Error('boom')) : Promise.resolve('ok');
    };

    await expect(cache.fetchQuery({ key: contact('1'), fetcher })).rejects.toThrow('boom');
    const second = await cache.fetchQuery({ key: contact('1'), fetcher });

    expect(second).toBe('ok');
    expect(calls).toBe(2);
  });

  test('6c. an aborted request is not stored as a successful entry', async () => {
    const cache = createQueryCache();
    const controller = new AbortController();
    const fetcher = ({ signal }) =>
      new Promise((resolve, reject) => {
        signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
        setTimeout(() => resolve('late'), 20);
      });

    const promise = cache.fetchQuery({ key: contact('1'), fetcher, signal: controller.signal });
    controller.abort();

    await expect(promise).rejects.toMatchObject({ name: 'AbortError' });
    expect(cache.has(contact('1'))).toBe(false);
  });

  test('7. no cached business payload is written to persistent storage', async () => {
    const cache = createQueryCache();
    await cache.fetchQuery({ key: contact('1'), fetcher: () => Promise.resolve({ secret: 'data' }) });
    cache.invalidate({ entity: 'Contact' });

    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });
});

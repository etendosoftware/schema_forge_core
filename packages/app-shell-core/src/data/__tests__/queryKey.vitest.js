import { describe, test, expect } from 'vitest';
import { createQueryKey, matchesQueryKey } from '../queryKey.js';

describe('createQueryKey', () => {
  test('identical inputs produce the same id', () => {
    const a = createQueryKey({ entity: 'Contact', recordId: '1' });
    const b = createQueryKey({ entity: 'Contact', recordId: '1' });
    expect(a.id).toBe(b.id);
  });

  test('filter order does not change the id', () => {
    const a = createQueryKey({ entity: 'Contact', filters: { name: 'a', active: true } });
    const b = createQueryKey({ entity: 'Contact', filters: { active: true, name: 'a' } });
    expect(a.id).toBe(b.id);
  });

  test.each([
    ['auth', { auth: 't1' }, { auth: 't2' }],
    ['org', { org: 'o1' }, { org: 'o2' }],
    ['role', { role: 'r1' }, { role: 'r2' }],
    ['apiBase', { apiBase: '/a' }, { apiBase: '/b' }],
    ['spec', { spec: 's1' }, { spec: 's2' }],
    ['entity', { entity: 'Contact' }, { entity: 'Order' }],
    ['filters', { filters: { q: '1' } }, { filters: { q: '2' } }],
    ['parentId', { parentId: 'p1' }, { parentId: 'p2' }],
    ['recordId', { recordId: '1' }, { recordId: '2' }],
  ])('a different %s isolates the key', (_dim, left, right) => {
    expect(createQueryKey(left).id).not.toBe(createQueryKey(right).id);
  });

  test('cache entries cannot leak across session/role/org boundaries', () => {
    const base = { entity: 'Contact', recordId: '1' };
    const sessionA = createQueryKey({ ...base, auth: 'tokenA', role: 'admin', org: 'orgA' });
    const sessionB = createQueryKey({ ...base, auth: 'tokenB', role: 'admin', org: 'orgA' });
    const roleB = createQueryKey({ ...base, auth: 'tokenA', role: 'user', org: 'orgA' });
    const orgB = createQueryKey({ ...base, auth: 'tokenA', role: 'admin', org: 'orgB' });

    const ids = new Set([sessionA.id, sessionB.id, roleB.id, orgB.id]);
    expect(ids.size).toBe(4); // all distinct
  });
});

describe('matchesQueryKey', () => {
  const descriptor = createQueryKey({ entity: 'Contact', recordId: '1', parentId: 'ord-9' }).descriptor;

  test('empty pattern matches everything', () => {
    expect(matchesQueryKey(descriptor, {})).toBe(true);
  });

  test('matches on a present field', () => {
    expect(matchesQueryKey(descriptor, { entity: 'Contact' })).toBe(true);
    expect(matchesQueryKey(descriptor, { entity: 'Order' })).toBe(false);
  });

  test('matches when all pattern fields agree', () => {
    expect(matchesQueryKey(descriptor, { entity: 'Contact', recordId: '1' })).toBe(true);
    expect(matchesQueryKey(descriptor, { entity: 'Contact', recordId: '2' })).toBe(false);
  });

  test('matches children by parentId', () => {
    expect(matchesQueryKey(descriptor, { parentId: 'ord-9' })).toBe(true);
    expect(matchesQueryKey(descriptor, { parentId: 'ord-1' })).toBe(false);
  });
});

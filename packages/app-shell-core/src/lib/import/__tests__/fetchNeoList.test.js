import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { fetchNeoList, NeoListError, NEO_LIST_PAGE_SIZE } from '../fetchNeoList.js';

/** A fetchFn that serves `rows` split into pages of `pageSize`, recording every URL it saw. */
function paged(rows, pageSize = NEO_LIST_PAGE_SIZE) {
  const urls = [];
  const fetchFn = async (url) => {
    urls.push(url);
    const start = Number(new URL(url, 'http://x').searchParams.get('_startRow'));
    const page = rows.slice(start, start + pageSize);
    return { ok: true, json: async () => ({ response: { data: page } }) };
  };
  return { fetchFn, urls };
}

const rowsOf = (n) => Array.from({ length: n }, (_, i) => ({ id: `R-${i}` }));

describe('fetchNeoList', () => {
  it('pages with _startRow/_endRow, which is what NEO actually reads', async () => {
    // ETP-5227: the callers sent `?limit=1000`, a parameter NEO ignores, and NEO's own default
    // (_endRow=100, NeoCrudHandler.applyPaginationDefaults) silently truncated the answer.
    const { fetchFn, urls } = paged(rowsOf(5));
    await fetchNeoList('/sws/neo/product-category/productCategory', { fetchFn });
    assert.match(urls[0], /_startRow=0&_endRow=199$/);
    assert.ok(!urls[0].includes('limit='), 'must not send a parameter NEO does not read');
  });

  it('reads every page, not just the first', async () => {
    // The whole point: a catalogue past one page used to come back truncated, and the caller
    // could not tell. 230 rows is two pages.
    const { fetchFn, urls } = paged(rowsOf(230));
    const out = await fetchNeoList('/x', { fetchFn });
    assert.equal(out.length, 230);
    assert.equal(urls.length, 2);
    assert.equal(out[229].id, 'R-229');
  });

  it('stops at the first short page instead of probing past the end', async () => {
    const { fetchFn, urls } = paged(rowsOf(5));
    assert.equal((await fetchNeoList('/x', { fetchFn })).length, 5);
    assert.equal(urls.length, 1);
  });

  it('returns an empty list for a genuinely empty collection, in one request', async () => {
    const { fetchFn, urls } = paged([]);
    assert.deepEqual(await fetchNeoList('/x', { fetchFn }), []);
    assert.equal(urls.length, 1);
  });

  it('joins its paging params with & when the URL already carries a query string', async () => {
    const { fetchFn, urls } = paged(rowsOf(1));
    await fetchNeoList('/x?_sortBy=name', { fetchFn });
    assert.match(urls[0], /\/x\?_sortBy=name&_startRow=0/);
  });

  it('accepts the bare `data` envelope as well as `response.data`', async () => {
    const fetchFn = async () => ({ ok: true, json: async () => ({ data: [{ id: 'A' }] }) });
    assert.deepEqual(await fetchNeoList('/x', { fetchFn }), [{ id: 'A' }]);
  });

  describe('a failed read is not an empty list', () => {
    // The old per-descriptor fetch swallowed every failure into `[]`, which is indistinguishable
    // from "this tenant has no categories" — so a 401 or a gateway blip sent the caller down the
    // auto-create path and the database rejected the insert on its unique index. The user saw
    // "there is already a Product Category with the same (…)" for a category plainly visible in
    // the UI. Throwing is what lets the caller say that instead.
    it('throws on a rejected response, carrying the status', async () => {
      const fetchFn = async () => ({ ok: false, status: 401, json: async () => ({}) });
      await assert.rejects(fetchNeoList('/x', { fetchFn }), (error) => {
        assert.ok(error instanceof NeoListError);
        assert.equal(error.status, 401);
        return true;
      });
    });

    it('throws when the body carries no readable row array', async () => {
      const fetchFn = async () => ({ ok: true, json: async () => ({ items: [{ id: 'A' }] }) });
      await assert.rejects(fetchNeoList('/x', { fetchFn }), NeoListError);
    });

    it('throws when the body is not JSON at all', async () => {
      const fetchFn = async () => ({ ok: true, json: async () => { throw new Error('not json'); } });
      await assert.rejects(fetchNeoList('/x', { fetchFn }), NeoListError);
    });

    it('throws when the request itself never lands', async () => {
      const fetchFn = async () => { throw new TypeError('Failed to fetch'); };
      await assert.rejects(fetchNeoList('/x', { fetchFn }), NeoListError);
    });
  });

  it('stops at maxPages so a server that ignores paging cannot spin forever', async () => {
    // Every page comes back full, which without the ceiling is an infinite loop.
    let calls = 0;
    const fetchFn = async () => {
      calls += 1;
      return { ok: true, json: async () => ({ response: { data: rowsOf(10) } }) };
    };
    const out = await fetchNeoList('/x', { fetchFn, pageSize: 10, maxPages: 3 });
    assert.equal(calls, 3);
    assert.equal(out.length, 30);
  });
});

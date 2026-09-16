import { apiFetch } from '../../auth/api.js';

/**
 * Read a whole NEO list endpoint, page by page.
 *
 * ## ETP-5227 — the bug this exists to stop repeating
 *
 * NEO pages with `_startRow`/`_endRow`, and `NeoCrudHandler.applyPaginationDefaults` fills in
 * `_endRow = 100` when a caller sends neither. Both import descriptors asked for their
 * dependent-entity catalogue with `?limit=1000` — a parameter NEO does not read at all — so the
 * request came back with the FIRST 100 records and looked like the complete table.
 *
 * Nothing anywhere reports that truncation, and the consequence is not a missing row: the
 * resolver concludes the referenced category does not exist, auto-creates it, and the database
 * rejects the insert on its unique index. The user is shown a raw backend complaint that "there
 * is already a Product Category with the same (Client, Organization, Search Key)" — about a
 * category they can see in the UI — for every product in the file.
 *
 * Every other list call in the app already uses `_startRow`/`_endRow`; these two were the
 * exceptions, and they were exceptions twice because the second descriptor was copied from the
 * first. Hence one shared reader rather than a third copy.
 *
 * ## Failing is not the same as being empty
 *
 * A rejected or unreadable response THROWS. It used to come back as `[]`, which is
 * indistinguishable from "this tenant has no categories" and sends the caller down the
 * auto-create path — turning a transient 401 or a gateway blip into permanent, confusing row
 * errors. A caller that genuinely wants to continue without the catalogue has to say so.
 */

/** Rows per request. Comfortably under any URL/response limit, and few enough round trips. */
export const NEO_LIST_PAGE_SIZE = 200;

/**
 * Ceiling on the number of requests, so a server that ignores paging (or a catalogue that grows
 * without bound) cannot spin here forever. 50 pages × 200 = 10 000 rows, far beyond any real
 * category/classification table; a caller needing more should be filtering server-side instead.
 */
export const NEO_LIST_MAX_PAGES = 50;

/** A NEO list could not be read. Distinct from "the list is empty" — see the header. */
export class NeoListError extends Error {
  constructor(message, { url, status = null } = {}) {
    super(message);
    this.name = 'NeoListError';
    this.url = url;
    this.status = status;
  }
}

/**
 * @param {string} url Absolute or app-relative list URL, WITHOUT paging params.
 * @param {object} [options]
 * @param {string} [options.token] Bearer token for a plain (non-React) caller.
 * @param {number} [options.pageSize]
 * @param {number} [options.maxPages]
 * @param {Function} [options.fetchFn] Injected for tests; defaults to the shared `apiFetch`.
 * @returns {Promise<Array<object>>} Every row the endpoint returns.
 * @throws {NeoListError} when any page is rejected or comes back in an unreadable shape.
 */
export async function fetchNeoList(url, {
  token,
  pageSize = NEO_LIST_PAGE_SIZE,
  maxPages = NEO_LIST_MAX_PAGES,
  fetchFn = apiFetch,
} = {}) {
  const separator = url.includes('?') ? '&' : '?';
  const rows = [];

  for (let page = 0; page < maxPages; page += 1) {
    const startRow = page * pageSize;
    const paged = `${url}${separator}_startRow=${startRow}&_endRow=${startRow + pageSize - 1}`;

    let res;
    try {
      res = await fetchFn(paged, { baseUrl: '', token });
    } catch (cause) {
      throw new NeoListError(`Could not reach ${url}: ${cause?.message ?? cause}`, { url });
    }
    if (!res.ok) {
      throw new NeoListError(`${url} responded ${res.status}`, { url, status: res.status });
    }

    const json = await res.json().catch(() => null);
    const data = json?.response?.data ?? json?.data ?? null;
    if (!Array.isArray(data)) {
      throw new NeoListError(`${url} returned no readable row array`, { url, status: res.status });
    }

    rows.push(...data);
    // A short page is the last page. Requesting the next one would be a wasted round trip, and
    // on a server that clamps the page size it would loop to `maxPages` every single time.
    if (data.length < pageSize) return rows;
  }

  return rows;
}

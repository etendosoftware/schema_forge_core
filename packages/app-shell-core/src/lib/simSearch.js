/**
 * Thin client for NEO Headless's global similarity-search endpoint
 * (`GET /sws/neo/simsearch`). Performs a similarity search across an Etendo
 * entity (BusinessPartner, Product, Organization, Currency, UOM,
 * ProductCategory, ...) and returns the best matching record id, plus every
 * other candidate the endpoint found.
 *
 * Reached through NEO's own JWT bearer auth rather than the "SimSearch"
 * Webhook this used to call — the Webhooks module requires a per-(webhook,
 * role) grant row in SMFWHE_DEFINEDWEBHOOK_ROLE, provisioned by hand per role
 * per environment; every NEO-authenticated caller can already reach this
 * endpoint with no extra grant (see NeoSimSearchEndpoint in com.etendoerp.go
 * for the full rationale). It accepts GET with query params and returns the
 * matching-results JSON directly — no `{ message: "..." }` wrapper, since
 * that wrapper was the Webhooks module's own envelope, not part of the
 * matching logic itself.
 */

/**
 * Resolve the base URL for webhook calls. We mirror the copilot detector —
 * strip off `/web/...` suffixes so the request targets Etendo's servlet root.
 */
function detectEtendoBase() {
  const path = window.location.pathname;
  const webIdx = path.indexOf('/web/');
  if (webIdx !== -1) return path.substring(0, webIdx);
  return import.meta.env.VITE_API_BASE || '';
}

/**
 * The real webhook (confirmed via a live capture) renders this field as a
 * formatted string with a trailing unit sign, e.g. `"100.0000%"` — not the
 * bare numeric string (`"85"`) every existing caller and test was written
 * against. `classifyCandidates` (resolveForeignKeys.js) does `Number(...)` on
 * this value to compare against its thresholds; `Number("100.0000%")` is
 * `NaN`, and `NaN < threshold` is always `false` in JS, so every real
 * candidate — good or bad — was silently classified as clearing the
 * confidence threshold. Stripping a trailing `%` here (only when present)
 * fixes that at the one place that knows the raw wire format, without
 * changing the value for the bare-numeric-string shape existing tests and
 * callers already depend on.
 */
function stripPercentSign(value) {
  return typeof value === 'string' ? value.replace(/%\s*$/, '') : value;
}

function mapRow(row) {
  return {
    id: row.id,
    name: row.name || row._identifier || row.id,
    similarityPercent: stripPercentSign(row.similarity_percent ?? row.similarityPercent),
  };
}

/**
 * Parse a `/sws/neo/simsearch` response body:
 *   { "item_0": {...}, "item_1": {...} }
 * where each value is a WSResult-shaped object whose `data` is an array of
 * `{ id, name, similarity_percent }`, best match first.
 *
 * Normalizes the response into an array (one entry per item in the original
 * request) of `{ id, name, similarityPercent, candidates } | null`. The
 * top-level `id`/`name`/`similarityPercent` mirror the best candidate — kept
 * for callers that only ever read the single best match. `candidates` carries
 * every match the endpoint returned (best-first) for callers that need to
 * disambiguate between close alternatives.
 *
 * @param {object} envelope - Parsed JSON body returned by fetch.
 * @param {number} itemCount - Number of items the request asked about.
 */
export function parseSimSearchEnvelope(envelope, itemCount) {
  if (!envelope || typeof envelope !== 'object') return Array(itemCount).fill(null);
  const results = [];
  for (let i = 0; i < itemCount; i += 1) {
    const entry = envelope[`item_${i}`];
    const data = entry?.data || entry?.response?.data;
    if (!Array.isArray(data) || data.length === 0) {
      results.push(null);
      continue;
    }
    const candidates = data.map(mapRow);
    results.push({ ...candidates[0], candidates });
  }
  return results;
}

/**
 * Run a similarity search for the given items against a single Etendo entity.
 *
 * @param {{
 *   token: string,
 *   entityName: 'BusinessPartner' | 'Product' | 'Organization' | 'Currency' | 'UOM' | 'ProductCategory' | string,
 *   items: string[],
 *   minSimPercent?: number,
 *   qtyResults?: number,
 * }} params
 * @returns {Promise<ReturnType<typeof parseSimSearchEnvelope>>}
 */
export async function simSearch({ token, entityName, items, minSimPercent = 30, qtyResults = 1 }) {
  if (!token || !entityName || !Array.isArray(items) || items.length === 0) {
    return Array(items?.length || 0).fill(null);
  }
  const base = detectEtendoBase();
  const qs = new URLSearchParams({
    entityName,
    items: JSON.stringify(items),
    minSimPercent: String(minSimPercent),
    qtyResults: String(qtyResults),
  });
  const url = `${base}/sws/neo/simsearch?${qs.toString()}`;
  try {
    const res = await fetch(url, {
      method: 'GET',
      credentials: 'include',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return Array(items.length).fill(null);
    const envelope = await res.json().catch(() => null);
    return parseSimSearchEnvelope(envelope, items.length);
  } catch {
    return Array(items.length).fill(null);
  }
}

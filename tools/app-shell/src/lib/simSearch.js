/**
 * Thin client for the Etendo SimSearch webhook
 * ({@link https://docs.etendo.software/ webhook name "SimSearch"}). Performs
 * a similarity search across an Etendo entity (BusinessPartner, Product,
 * Organization, Currency, ...) and returns the best matching record id.
 *
 * The webhook is mounted at `/webhooks/?name=SimSearch` on the Etendo server.
 * It accepts GET with query params and returns a JSON envelope whose `message`
 * field is a stringified JSON mapping each item index to its search result.
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
 * Parse a SimSearch response envelope. The webhook returns:
 *   { message: "{ \"item_0\": {...}, \"item_1\": {...} }" }
 * where each value is a WSResult-shaped object whose `data` is an array of
 * `{ id, name, similarity_percent }`.
 *
 * This helper normalizes the response into an array (one entry per item in
 * the original request) of `{ id, name, similarityPercent } | null`.
 *
 * @param {object} envelope - Parsed JSON body returned by fetch.
 * @param {number} itemCount - Number of items the request asked about.
 */
export function parseSimSearchEnvelope(envelope, itemCount) {
  const raw = envelope?.message;
  if (!raw || typeof raw !== 'string') return Array(itemCount).fill(null);
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return Array(itemCount).fill(null);
  }
  const results = [];
  for (let i = 0; i < itemCount; i += 1) {
    const entry = parsed[`item_${i}`];
    const data = entry?.data || entry?.response?.data;
    const first = Array.isArray(data) ? data[0] : null;
    if (first?.id) {
      results.push({
        id: first.id,
        name: first.name || first._identifier || first.id,
        similarityPercent: first.similarity_percent ?? null,
      });
    } else {
      results.push(null);
    }
  }
  return results;
}

/**
 * Run a similarity search for the given items against a single Etendo entity.
 *
 * @param {{
 *   token: string,
 *   entityName: 'BusinessPartner' | 'Product' | 'Organization' | 'Currency' | string,
 *   items: string[],
 *   minSimPercent?: number,
 *   qtyResults?: number,
 * }} params
 * @returns {Promise<Array<{ id: string, name: string, similarityPercent: string|null } | null>>}
 */
export async function simSearch({ token, entityName, items, minSimPercent = 30, qtyResults = 1 }) {
  if (!token || !entityName || !Array.isArray(items) || items.length === 0) {
    return Array(items?.length || 0).fill(null);
  }
  const base = detectEtendoBase();
  const qs = new URLSearchParams({
    name: 'SimSearch',
    entityName,
    items: JSON.stringify(items),
    minSimPercent: String(minSimPercent),
    qtyResults: String(qtyResults),
  });
  const url = `${base}/webhooks/?${qs.toString()}`;
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

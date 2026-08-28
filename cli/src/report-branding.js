/**
 * Shared branding data for server-rendered document reports (ETP-4998,
 * ETP-5013).
 *
 * Document report SQL exposes the organization's image id as `header.org_logo_id`. The
 * report engine uses the authenticated NEO image endpoint to retrieve the same
 * company document image used by the app-shell PDF previews, then embeds it as
 * a data URL so jsreport does not need browser credentials or network access.
 *
 * Moved here from the Vite dev plugin (ETP-5013) after ETP-4998 shipped it
 * ONLY in `report-api.js` — `tools/report-server/server.js` never imported it,
 * never expanded the `{{> document-branding}}` partial, and never injected
 * `org_logo_id` into the header SQL, so every `print-*` document broke with
 * "The partial document-branding could not be found" when rendered through
 * the production server. Same failure class as ETP-4898/4899/4908: code that
 * lives in a shared module reaches production, code written inline in the dev
 * plugin never does. Do not re-add a local copy — extend this module.
 *
 * Works for BOTH document ("header.org_logo_id" from the header SQL row) and
 * listing reports (a synthetic `{ org_logo_id }` object resolved from
 * `params.orgId` via `ad_orginfo` — see the report engines) — this function
 * doesn't care where `org_logo_id` came from, only that the object has one.
 */
export async function hydrateDocumentBranding(header, {
  authToken,
  etendoBase = 'http://localhost:8080/etendo',
  fetchImpl = fetch,
} = {}) {
  if (!header || !header.org_logo_id || !authToken) return header;

  try {
    const imageUrl = `${etendoBase}/sws/neo/image/${encodeURIComponent(header.org_logo_id)}`;
    const response = await fetchImpl(imageUrl, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    if (!response.ok) return header;

    const contentType = response.headers.get('content-type') || 'image/png';
    const bytes = Buffer.from(await response.arrayBuffer());
    return {
      ...header,
      companyLogoDataUrl: `data:${contentType};base64,${bytes.toString('base64')}`,
    };
  } catch {
    // Branding is deliberately fail-soft: an unavailable image must not make
    // an otherwise valid business document impossible to print.
    return header;
  }
}

/**
 * Resolves a listing report's company logo (ETP-5013 follow-up) — a single
 * shared helper so all THREE report-fetching branches (SQL/Jasper, NEO,
 * document) in both engines call the exact same two-step lookup instead of
 * duplicating it. Missed initially: the first pass only wired this into the
 * SQL/Jasper branch, so the 4 NEO-sourced listing reports (Aging of
 * Payables/Receivables, Tax Report, Inventory Stock Report) silently never
 * got a logo — same "only wired in one of several branches" shape as the
 * server.js gap this module's own docstring describes.
 *
 * Two-step: prefer the report's own `orgId` filter (most precise — matches
 * what the report is actually scoped to); fall back to ANY org of the same
 * client that has a logo configured when `orgId` is absent (Inventory Stock
 * Report, Order Not Shipped) or that specific org has none set. One company
 * logo per client is the common real-world case (orgs = branches of the same
 * legal entity), so this fallback is a reasonable default, not a guess.
 *
 * `pool` must already be open — callers that don't have one yet (the NEO
 * branch has no DB access otherwise) open a short-lived one just for this.
 */
export async function resolveCompanyLogoDataUrl(pool, { clientId, orgId, authToken, etendoBase } = {}) {
  if (!clientId) return undefined;

  let logoRow;
  if (orgId) {
    const result = await pool.query(
      'SELECT your_company_document_image AS org_logo_id FROM ad_orginfo WHERE ad_org_id = $1',
      [orgId],
    );
    logoRow = result.rows[0];
  }
  if (!logoRow?.org_logo_id) {
    const result = await pool.query(
      'SELECT your_company_document_image AS org_logo_id FROM ad_orginfo ' +
      'WHERE ad_client_id = $1 AND your_company_document_image IS NOT NULL ' +
      'ORDER BY ad_org_id LIMIT 1',
      [clientId],
    );
    logoRow = result.rows[0];
  }

  const branded = await hydrateDocumentBranding(logoRow || {}, { authToken, etendoBase });
  return branded.companyLogoDataUrl;
}

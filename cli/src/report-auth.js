/**
 * report-auth.js — resolves report request identity from the Etendo cookie
 * session (ETP-5460).
 *
 * Both report engines (`tools/report-server/server.js` and, in the
 * functional repo, `report-api.js`) used to read `Authorization: Bearer`
 * only, decoding the JWT payload locally WITHOUT verifying its signature to
 * pull `clientId` — a forged token could read another tenant's SQL reports.
 * The SPA moved to an HttpOnly `__Host-go_session` cookie (ETP-4576/4575)
 * and stopped sending `Authorization` entirely, so every report call
 * degraded silently instead: NEO calls threw "No auth token", SQL/selector
 * reports fell back to `getClientIdFromToken(...) || '0'` (System scope —
 * an empty report, no error).
 *
 * This module is the single place that resolves identity for BOTH engines:
 * it calls `GET /sws/go/session`, forwarding ONLY the session cookie pair
 * (never the whole incoming Cookie header, never relaying a Set-Cookie back
 * to the caller), and it never falls back to client '0'. See design id 455 /
 * spec id 454 (capability: report-session-auth) for the full rationale and
 * the status-mapping table this module implements.
 */
import { timingSafeEqual } from 'node:crypto';
import { resolvePlaceholderValue } from './report-sql.js';

const SESSION_COOKIE_NAME = '__Host-go_session';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export class ReportAuthError extends Error {
  constructor(status, code, message) {
    super(message || code);
    this.name = 'ReportAuthError';
    this.status = status;
    this.code = code;
  }
}

/**
 * Extracts the `__Host-go_session=<value>` pair out of a full `Cookie`
 * header, or null when it isn't present. Returns only that one pair — never
 * the whole header — so callers never accidentally forward unrelated
 * cookies to Etendo.
 */
export function extractSessionCookie(cookieHeader) {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(';')) {
    const eqIdx = part.indexOf('=');
    if (eqIdx === -1) continue;
    const name = part.slice(0, eqIdx).trim();
    if (name === SESSION_COOKIE_NAME) {
      return `${name}=${part.slice(eqIdx + 1).trim()}`;
    }
  }
  return null;
}

/** Case-insensitive header lookup — real Node request headers are already
 * lowercased, but callers (and tests) may pass mixed case. */
function getHeader(headers, name) {
  if (!headers) return undefined;
  const lower = name.toLowerCase();
  for (const key of Object.keys(headers)) {
    if (key.toLowerCase() === lower) return headers[key];
  }
  return undefined;
}

/** Constant-time string compare — a CSRF token comparison must not leak
 * timing information about how many leading characters matched. */
function constantTimeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || !a || !b) return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * Resolves the caller's identity from the session cookie forwarded on
 * `headers`, calling `GET ${etendoBase}/sws/go/session`.
 *
 * Status mapping (never deviate — a 502 must never be reported as 401, or a
 * transient Etendo blip logs the user out client-side; see `apiFetch`'s
 * `on401` handler):
 *   - no cookie / Etendo non-2xx below 500 / no resolvable clientId -> 401
 *   - CSRF check fails on an unsafe method                          -> 403
 *   - network error / Etendo 5xx / non-JSON response                -> 502
 *
 * @returns {Promise<{clientId: string, orgId: ?string, roleId: ?string, userId: ?string, roleOrgIds: string[], forwardHeaders: object}>}
 */
export async function resolveReportSession(headers, {
  method = 'GET',
  etendoBase = 'http://localhost:8080/etendo',
  fetchImpl = fetch,
} = {}) {
  const cookieHeader = getHeader(headers, 'cookie');
  const sessionCookie = extractSessionCookie(cookieHeader);
  if (!sessionCookie) {
    throw new ReportAuthError(401, 'NO_SESSION', 'No session cookie');
  }

  let res;
  try {
    res = await fetchImpl(`${etendoBase}/sws/go/session`, {
      headers: { Cookie: sessionCookie },
    });
  } catch (e) {
    throw new ReportAuthError(502, 'SESSION_BACKEND_UNAVAILABLE', e.message);
  }

  if (!res.ok) {
    if (res.status >= 500) {
      throw new ReportAuthError(502, 'SESSION_BACKEND_UNAVAILABLE', `Etendo session check returned ${res.status}`);
    }
    throw new ReportAuthError(401, 'NO_SESSION', `Etendo session check returned ${res.status}`);
  }

  let body;
  try {
    body = await res.json();
  } catch (e) {
    throw new ReportAuthError(502, 'SESSION_BACKEND_UNAVAILABLE', 'Non-JSON session response');
  }

  const environment = body?.environment;
  const clientId = environment?.clientId;
  if (!environment || !clientId) {
    throw new ReportAuthError(401, 'NO_SESSION', 'Session has no resolvable clientId');
  }

  const forwardHeaders = { Cookie: sessionCookie };
  const origin = getHeader(headers, 'origin');
  const referer = getHeader(headers, 'referer');
  if (origin) forwardHeaders.Origin = origin;
  else if (referer) forwardHeaders.Referer = referer;

  const isUnsafe = !SAFE_METHODS.has(String(method).toUpperCase());
  if (isUnsafe) {
    const csrfHeader = getHeader(headers, 'x-go-csrf');
    if (!constantTimeEqual(csrfHeader, body?.csrfToken)) {
      throw new ReportAuthError(403, 'CSRF_REJECTED', 'Missing or mismatched X-Go-CSRF header');
    }
    forwardHeaders['X-Go-CSRF'] = csrfHeader;
  }

  return {
    clientId,
    orgId: environment.orgId,
    roleId: environment.roleId,
    userId: environment.userId,
    // ETP-6080: the orgs AD_Role_OrgAccess grants the session's role — the
    // session body already carries them (roleList[].orgList), for every role
    // of the user, so only the ACTIVE role's list is kept.
    roleOrgIds: (body.roleList || [])
      .find((role) => role?.id === environment.roleId)?.orgList
      ?.map((org) => org?.id).filter(Boolean) || [],
    forwardHeaders,
  };
}

/** True when any of the report's SQL statements filters by `__ORGID__`. */
function reportFiltersByOrg(contract) {
  return Object.values(contract?.sql || {}).some((q) => typeof q === 'string' && q.includes('__ORGID__'));
}

/**
 * ETP-6080: rejects a report request whose `orgId` the session's role cannot
 * read, BEFORE any report SQL runs. The client always comes from the session;
 * this closes the same-client gap (a role limited to some orgs reading the
 * others by changing, blanking or omitting `orgId`).
 *
 * Rule — Etendo's readable orgs (`OBContext.setReadableOrganizations`):
 *   - org `0` in the role's access → every org of the client passes;
 *   - otherwise the requested org must be one of the role's orgs or a
 *     descendant of one. Unlike OBContext, an ANCESTOR is rejected: the report
 *     SQL expands `orgId` to its whole subtree, so a parent would expose
 *     sibling orgs the role cannot read;
 *   - an empty, absent or `0` orgId means "every org" to the SQL
 *     (`stripBlankOptionalClauses` drops the unfilled clause), so it passes
 *     only if the role's orgs and their descendants cover the whole client —
 *     INACTIVE orgs included: the report SQL reads their postings too.
 *
 * The requested org is the value that will fill `__ORGID__`
 * (`resolvePlaceholderValue`: the declared param, its default), not a
 * hardcoded `params.orgId`.
 *
 * Applies only to reports whose SQL contains `__ORGID__` — a NEO-sourced
 * report that merely declares `orgId`, or a printable, is not checked here.
 *
 * @param {{query: Function}} pool pg pool/client
 * @param {{clientId: string, roleOrgIds: string[]}} session from resolveReportSession
 * @param {{contract: object, params: object}} request the render/query params
 * @throws {ReportAuthError} 403 ORG_ACCESS_DENIED
 */
export async function assertReportOrgAccess(pool, session, { contract, params = {} }) {
  if (!reportFiltersByOrg(contract)) return;
  const denied = () => new ReportAuthError(403, 'ORG_ACCESS_DENIED', 'The role has no access to the requested organization');
  const { value: orgId, ambiguous } = resolvePlaceholderValue(contract, params, 'ORGID');
  if (ambiguous) throw denied(); // two declared params fill __ORGID__: refuse rather than guess

  const roleOrgIds = session?.roleOrgIds || [];
  if (roleOrgIds.includes('0')) return;
  if (!roleOrgIds.length) throw denied();

  const requested = orgId !== '0' ? orgId : '';
  if (requested) {
    const { rows } = await pool.query(
      `SELECT 1 FROM unnest($1::varchar[]) AS r(org_id)
        WHERE ad_isorgincluded($2, r.org_id, $3) <> -1 LIMIT 1`,
      [roleOrgIds, requested, session.clientId],
    );
    if (!rows.length) throw denied();
    return;
  }

  const { rows } = await pool.query(
    `SELECT 1 FROM ad_org o
      WHERE o.ad_client_id = $1 AND o.ad_org_id <> '0'
        AND NOT EXISTS (SELECT 1 FROM unnest($2::varchar[]) AS r(org_id)
                         WHERE ad_isorgincluded(o.ad_org_id, r.org_id, $1) <> -1)
      LIMIT 1`,
    [session.clientId, roleOrgIds],
  );
  if (rows.length) throw denied();
}

/** NEO answers `{result: "<json>"}` (a string or an object) or the bare object. */
function unwrapNeoResult(body) {
  const result = body?.result ?? body;
  return typeof result === 'string' ? JSON.parse(result) : result;
}

/**
 * ETP-6080: rejects a report the session's role cannot open, BEFORE any report
 * data is read. The source is the same map the report catalog uses, NEO's
 * `myreportaccess` (SFMyReportAccess in com.etendoerp.go): `governed` lists the
 * report ids the Informes access catalog controls, `reportAccess` the ones this
 * role can open (any tier). A report outside `governed` (a printable, a report
 * left open by design) passes.
 *
 * shortcut: a backend that does not send `governed` yet (older com.etendoerp.go
 * during a deploy) is not enforced; drop that branch once every environment
 * runs the module version that sends it.
 *
 * @param {{forwardHeaders: object}} session from resolveReportSession
 * @param {string} reportId the report being rendered or queried
 * @param {{etendoBase: string, fetchImpl?: Function}} deps
 * @throws {ReportAuthError} 403 REPORT_ACCESS_DENIED, 502 REPORT_ACCESS_UNAVAILABLE
 */
export async function assertReportAccess(session, reportId, { etendoBase, fetchImpl = fetch } = {}) {
  const unavailable = (msg) => new ReportAuthError(502, 'REPORT_ACCESS_UNAVAILABLE', msg);
  let res;
  try {
    res = await fetchImpl(`${etendoBase}/sws/neo/myreportaccess`, { headers: session?.forwardHeaders || {} });
  } catch (e) {
    throw unavailable(e.message);
  }
  if (!res.ok) throw unavailable(`Etendo report access check returned ${res.status}`);
  let data;
  try {
    data = unwrapNeoResult(await res.json());
  } catch {
    throw unavailable('Unreadable report access response');
  }
  if (!Array.isArray(data?.governed)) return;
  if (data.governed.includes(reportId) && !data.reportAccess?.[reportId]) {
    throw new ReportAuthError(403, 'REPORT_ACCESS_DENIED', 'The role has no access to this report');
  }
}

/**
 * Maps any error thrown by `resolveReportSession` (or an unexpected one, as
 * a safe default) to an HTTP status + JSON body an engine's route handler
 * can respond with directly. A non-`ReportAuthError` defaults to 502, never
 * 401 — an unrecognized failure must not look like "your session expired".
 */
export function reportAuthErrorBody(err) {
  if (err instanceof ReportAuthError) {
    return { status: err.status, body: { error: err.message, code: err.code } };
  }
  return { status: 502, body: { error: err?.message || 'Session backend unavailable', code: 'SESSION_BACKEND_UNAVAILABLE' } };
}

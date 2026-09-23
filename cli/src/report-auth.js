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
 * @returns {Promise<{clientId: string, orgId: ?string, roleId: ?string, userId: ?string, forwardHeaders: object}>}
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
    forwardHeaders,
  };
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

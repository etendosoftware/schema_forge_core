import { decodeJwtPayload } from './session.js';

const isId = (value) => typeof value === 'string' && value.length > 0;
const same = (a, b) => a === b;
const identityClaims = ['user', 'client', 'role', 'organization'];

// Shape contract for `session.roleList` / `{ unchanged: true }.roleList`: a non-empty array of
// `{ id, name, orgList: [{ id, name }] }` with no duplicate role or organization ids. Shared by
// the full metadata path and the `unchanged: true` refresh-only path below.
function isValidRoleList(roleList) {
  if (!Array.isArray(roleList) || roleList.length === 0) return false;
  const ids = new Set();
  for (const role of roleList) {
    if (!role || !isId(role.id) || typeof role.name !== 'string' || ids.has(role.id)
        || !Array.isArray(role.orgList)) return false;
    ids.add(role.id);
    const orgIds = new Set();
    for (const org of role.orgList) {
      if (!org || !isId(org.id) || typeof org.name !== 'string' || orgIds.has(org.id)) return false;
      orgIds.add(org.id);
    }
  }
  return true;
}

/**
 * ETP-5395 — a cookie session holds no token, so there is nothing to diff the new token against
 * (the bearer path below compares user/client claims before and after). The server derived this
 * metadata from the cookie session's own user, so the checks here are: same tenant as the session,
 * metadata consistent with the new token's own claims, and a valid role/org. The token itself is
 * discarded — a cookie session must never start sending a bearer.
 */
function reconcileCookieSession(current, response, after) {
  const metadata = response.session;
  // A bare token without metadata is meaningless to a cookie client: keep the session and let the
  // access maps (resolved server-side) revalidate.
  if (metadata == null) return { status: 'legacy' };
  const invalid = { status: 'metadata-required' };
  if (!isId(current.clientId) || current.clientId !== after.client) return invalid;
  if (metadata.version !== 1 || !identityClaims.every((key) => isId(after[key]))) return invalid;
  if (metadata.userId !== after.user || metadata.clientId !== after.client
      || metadata.selectedRoleId !== after.role || metadata.selectedOrgId !== after.organization) return invalid;
  if (!isValidRoleList(metadata.roleList)) return invalid;
  const selectedRole = metadata.roleList.find((role) => role.id === after.role);
  const selectedOrg = selectedRole?.orgList.find((org) => org.id === after.organization);
  if (!selectedRole || !selectedOrg) return invalid;
  return {
    status: 'ready',
    session: { ...current, roleList: metadata.roleList, selectedRole, selectedOrg },
  };
}

/**
 * Proposed SFRefreshToken session v1 contract; backend support is a separate rollout.
 * JWT decoding is a consistency check, never signature verification or authorization.
 */
export function reconcileSessionRefresh(current, response) {
  // [ETP-5195 follow-up] `SFRefreshToken` skips minting a new JWT entirely when the caller's
  // role hasn't changed (it was previously reissuing one, with a fresh iat/exp, on EVERY call —
  // the whole reason a no-op refresh needed the `sameFlatMap`/`bump` machinery elsewhere in this
  // file's caller). `{ unchanged: true }` never carries a token, but it MAY carry a fresh
  // `roleList` (ETP-5329: role TEMPLATE composition can change — e.g. a demotion — while the
  // personal AD_Role id, and so the JWT, stays the same). When that roleList is present and
  // valid, surface it as a real session update: `status: 'ready'` is what the caller
  // (AuthContext.jsx) already branches on via `outcome.session` to replace roleList/selectedRole
  // and revalidate access, and it does so WITHOUT touching `current.token` (kept as-is, since it
  // genuinely did not change). `selectedRole`/`selectedOrg` are re-derived from the CURRENT
  // session's already-selected ids — there is no freshly decoded token here to read them from.
  // Any missing/empty/malformed roleList falls back to the pre-existing no-op 'legacy' path.
  if (response?.unchanged === true) {
    const roleList = response.roleList;
    if (isValidRoleList(roleList)) {
      // ETP-5395: the server reports the role/org this request was authorized with. A cookie
      // session is rebound server-side when its role is revoked, and a cookie client has no token
      // to learn that from, so prefer these over the ids the client still holds.
      const roleId = isId(response.selectedRoleId) ? response.selectedRoleId : current.selectedRole?.id;
      const orgId = isId(response.selectedOrgId) ? response.selectedOrgId : current.selectedOrg?.id;
      const selectedRole = roleList.find((role) => role.id === roleId);
      const selectedOrg = selectedRole?.orgList.find((org) => org.id === orgId);
      if (selectedRole && selectedOrg) {
        return { status: 'ready', session: { ...current, roleList, selectedRole, selectedOrg } };
      }
    }
    return { status: 'legacy' };
  }
  const token = response?.token;
  const before = decodeJwtPayload(current.token);
  const after = decodeJwtPayload(token);
  if (!isId(token) || !after || typeof after !== 'object' || Array.isArray(after)) {
    return { status: response?.session != null ? 'metadata-required' : 'failed' };
  }
  if (!current.token) return reconcileCookieSession(current, response, after);
  const changed = identityClaims.some((key) => !same(before?.[key], after[key]));
  // A persisted tenant/token mismatch is not a usable legacy fallback either.
  if (current.clientId && after.client && current.clientId !== after.client) {
    return { status: 'metadata-required' };
  }
  const metadata = response.session;
  if (metadata == null) {
    return { status: changed ? 'metadata-required' : 'legacy' };
  }
  const invalid = () => ({ status: 'metadata-required' });
  if (metadata.version !== 1 || !identityClaims.every((key) => isId(after[key]))) return invalid();
  // Refresh can change role/org, never the authenticated user or tenant.
  if (!before || before.user !== after.user || before.client !== after.client
      || (current.clientId && current.clientId !== after.client)) return invalid();
  if (metadata.userId !== after.user || metadata.clientId !== after.client
      || metadata.selectedRoleId !== after.role || metadata.selectedOrgId !== after.organization) return invalid();
  if (!isValidRoleList(metadata.roleList)) return invalid();
  const selectedRole = metadata.roleList.find((role) => role.id === after.role);
  const selectedOrg = selectedRole?.orgList.find((org) => org.id === after.organization);
  if (!selectedRole || !selectedOrg) return invalid();
  return {
    status: 'ready',
    session: { ...current, token, clientId: metadata.clientId, roleList: metadata.roleList, selectedRole, selectedOrg },
  };
}

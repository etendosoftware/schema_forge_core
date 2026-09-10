import { decodeJwtPayload } from './session.js';

const isId = (value) => typeof value === 'string' && value.length > 0;
const same = (a, b) => a === b;
const identityClaims = ['user', 'client', 'role', 'organization'];

/**
 * Proposed SFRefreshToken session v1 contract; backend support is a separate rollout.
 * JWT decoding is a consistency check, never signature verification or authorization.
 */
export function reconcileSessionRefresh(current, response) {
  // [ETP-5195 follow-up] `SFRefreshToken` now skips minting a new JWT entirely when the
  // caller's role hasn't changed (it was previously reissuing one, with a fresh iat/exp,
  // on EVERY call — the whole reason a no-op refresh needed the `sameFlatMap`/`bump`
  // machinery elsewhere in this file's caller). `{ unchanged: true }` carries no token/session
  // at all; route it through the EXISTING 'legacy' no-op path (same as a legacy backend
  // response with an unchanged role) rather than inventing a new status — the caller already
  // knows how to handle 'legacy' correctly (revalidate access, never touch the session/token).
  if (response?.unchanged === true) {
    return { status: 'legacy' };
  }
  const token = response?.token;
  const before = decodeJwtPayload(current.token);
  const after = decodeJwtPayload(token);
  if (!isId(token) || !after || typeof after !== 'object' || Array.isArray(after)) {
    return { status: response?.session != null ? 'metadata-required' : 'failed' };
  }
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
  if (!Array.isArray(metadata.roleList) || metadata.roleList.length === 0) return invalid();
  const ids = new Set();
  for (const role of metadata.roleList) {
    if (!role || !isId(role.id) || typeof role.name !== 'string' || ids.has(role.id)
        || !Array.isArray(role.orgList)) return invalid();
    ids.add(role.id);
    const orgIds = new Set();
    for (const org of role.orgList) {
      if (!org || !isId(org.id) || typeof org.name !== 'string' || orgIds.has(org.id)) return invalid();
      orgIds.add(org.id);
    }
  }
  const selectedRole = metadata.roleList.find((role) => role.id === after.role);
  const selectedOrg = selectedRole?.orgList.find((org) => org.id === after.organization);
  if (!selectedRole || !selectedOrg) return invalid();
  return {
    status: 'ready',
    session: { ...current, token, clientId: metadata.clientId, roleList: metadata.roleList, selectedRole, selectedOrg },
  };
}

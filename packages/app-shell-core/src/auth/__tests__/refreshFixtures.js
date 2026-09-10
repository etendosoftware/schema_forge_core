// Synthetic identities for the session contract; these are not AD record IDs.
export function sessionFixture({ tenant = 'X', role = 'personal', org = 'main', revision = 0 } = {}) {
  const claims = { user: `user-${tenant}`, client: `tenant-${tenant}`, role: `${tenant}-${role}`,
    organization: `${tenant}-${org}`, iat: revision };
  const token = `eyJhbGciOiJub25lIn0.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.fixture`;
  const selectedOrg = { id: claims.organization, name: `${tenant} ${org}` };
  const selectedRole = { id: claims.role, name: `${tenant} ${role}`, orgList: [selectedOrg] };
  return { token, username: 'shared-account', clientId: claims.client,
    roleList: [selectedRole], selectedRole, selectedOrg };
}

export function metadataResponse(session) {
  const claims = JSON.parse(Buffer.from(session.token.split('.')[1], 'base64url').toString());
  return { token: session.token, session: { version: 1, userId: claims.user,
    clientId: session.clientId, selectedRoleId: session.selectedRole.id,
    selectedOrgId: session.selectedOrg.id, roleList: session.roleList } };
}

export function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

export const jsonResponse = (body, status = 200) => ({ ok: status >= 200 && status < 300,
  status, json: async () => body });

/**
 * [ETP-5195] `/sws/neo/refreshtoken` goes through the NEO webhook bridge, which wraps every
 * response in `{"result": "<json-string>"}` — the real `{token, session}` payload is nested and
 * JSON-encoded, not top-level (see `AuthContext.jsx`'s `unwrapBridgeEnvelope`). Fixtures for
 * OTHER endpoints (e.g. `/sws/neo/access`, `/session`) still use the plain `jsonResponse` above —
 * only the refreshtoken response itself needs this envelope.
 */
export const refreshResponse = (body, status = 200) => jsonResponse({ result: JSON.stringify(body) }, status);

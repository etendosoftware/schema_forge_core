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

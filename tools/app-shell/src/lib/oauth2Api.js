/**
 * OAuth2 Client Management API
 *
 * Provides functions to interact with the OAuth2 backend endpoints at /sws/oauth2/*.
 * All functions receive an `apiFetch` instance (from createApiFetch in auth/api.js)
 * which handles Bearer token injection and 401 redirects.
 */

/**
 * List all OAuth2 clients.
 * @param {Function} apiFetch - Fetch wrapper from createApiFetch
 * @returns {Promise<Array>} Array of client objects
 */
export async function listClients(apiFetch) {
  const res = await apiFetch('/sws/oauth2/clients');
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `Failed to list clients: ${res.status}`);
  }
  return res.json();
}

/**
 * Create a new OAuth2 client.
 * @param {Function} apiFetch - Fetch wrapper from createApiFetch
 * @param {Object} params - Client creation parameters
 * @param {string} params.name - Display name
 * @param {string} params.adUserId - Etendo AD_User ID
 * @param {string} params.adRoleId - Etendo AD_Role ID
 * @param {string[]} params.scopes - Granted scopes
 * @param {boolean} params.isActive - Whether the client is active
 * @returns {Promise<Object>} Created client with clientSecret (plaintext, shown once)
 */
export async function createClient(apiFetch, { name, adUserId, adRoleId, scopes, isActive }) {
  const res = await apiFetch('/sws/oauth2/clients', {
    method: 'POST',
    body: JSON.stringify({ name, adUserId, adRoleId, scopes, isActive }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `Failed to create client: ${res.status}`);
  }
  return res.json();
}

/**
 * Update an existing OAuth2 client.
 * @param {Function} apiFetch - Fetch wrapper from createApiFetch
 * @param {string} id - Client ID
 * @param {Object} params - Fields to update
 * @returns {Promise<Object>} Updated client
 */
export async function updateClient(apiFetch, id, { name, adUserId, adRoleId, scopes, isActive }) {
  const res = await apiFetch(`/sws/oauth2/clients/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ name, adUserId, adRoleId, scopes, isActive }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `Failed to update client: ${res.status}`);
  }
  return res.json();
}

/**
 * Delete an OAuth2 client.
 * @param {Function} apiFetch - Fetch wrapper from createApiFetch
 * @param {string} id - Client ID
 * @returns {Promise<void>}
 */
export async function deleteClient(apiFetch, id) {
  const res = await apiFetch(`/sws/oauth2/clients/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `Failed to delete client: ${res.status}`);
  }
}

/**
 * Regenerate the client secret. Returns the new plaintext secret (shown once).
 * @param {Function} apiFetch - Fetch wrapper from createApiFetch
 * @param {string} id - Client ID
 * @returns {Promise<Object>} Object with clientSecret field
 */
export async function regenerateSecret(apiFetch, id) {
  const res = await apiFetch(`/sws/oauth2/clients/${id}/regenerate-secret`, {
    method: 'PUT',
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `Failed to regenerate secret: ${res.status}`);
  }
  return res.json();
}

/**
 * Revoke all active tokens for a client.
 * @param {Function} apiFetch - Fetch wrapper from createApiFetch
 * @param {string} id - Client ID (sent as clientId in body)
 * @returns {Promise<void>}
 */
export async function revokeTokens(apiFetch, id) {
  const res = await apiFetch('/sws/oauth2/revoke', {
    method: 'POST',
    body: JSON.stringify({ clientId: id }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `Failed to revoke tokens: ${res.status}`);
  }
}

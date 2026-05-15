/**
 * Thin client for the NEO Headless attachments endpoints
 * (com.etendoerp.go NeoBuiltInEndpointHandler /sws/neo/attachments/*).
 *
 * Splits the two-step access pattern: `listAttachments` returns lightweight
 * metadata rows, `fetchAttachmentBlobUrl` downloads a single file as a blob URL
 * the caller can hand to <iframe>/<embed>/react-pdf. Working with blobs avoids
 * the base64 round-trip that the legacy ListAttachments webhook required.
 */

function detectAttachmentsBase(apiBaseUrl) {
  // apiBaseUrl may be the full spec URL (e.g. http://host/sws/neo/sales-order).
  // Strip the spec-specific segment so we get the root proxy base.
  if (apiBaseUrl) return apiBaseUrl.split('/sws/neo/')[0];
  const path = typeof window !== 'undefined' ? window.location.pathname : '';
  const webIdx = path.indexOf('/web/');
  if (webIdx !== -1) return path.substring(0, webIdx);
  return (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE) || '';
}

/**
 * Fetch the attachments tied to (tableName, recordId). Returns an array of
 * `{ id, name, ... }` rows (metadata only — no file bytes). Never throws —
 * returns [] on any error so the UI can stay simple.
 *
 * @param {{ token: string, tableName: string, recordId: string, apiBaseUrl?: string }} params
 */
export async function listAttachments({ token, tableName, recordId, apiBaseUrl } = {}) {
  if (!token || !tableName || !recordId) return [];
  const base = detectAttachmentsBase(apiBaseUrl);
  const url = `${base}/sws/neo/attachments/${tableName}/${recordId}`;
  try {
    const res = await fetch(url, {
      method: 'GET',
      credentials: 'include',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return [];
    const json = await res.json().catch(() => null);
    const data = json?.items ?? json?.response?.data ?? json?.data ?? json;
    return Array.isArray(data) ? data.filter((row) => row && row.id) : [];
  } catch {
    return [];
  }
}

/**
 * Download a single attachment as a Blob URL. Caller is responsible for
 * `URL.revokeObjectURL` when the document unmounts to avoid leaking memory.
 * Returns null on any failure so callers can short-circuit gracefully.
 *
 * @param {{ token: string, attachmentId: string, apiBaseUrl?: string }} params
 */
export async function fetchAttachmentBlobUrl({ token, attachmentId, apiBaseUrl } = {}) {
  if (!token || !attachmentId) return null;
  const base = detectAttachmentsBase(apiBaseUrl);
  const url = `${base}/sws/neo/attachments/file/${attachmentId}`;
  try {
    const res = await fetch(url, {
      method: 'GET',
      credentials: 'include',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  } catch {
    return null;
  }
}

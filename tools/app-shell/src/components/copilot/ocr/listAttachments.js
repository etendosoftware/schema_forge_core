/**
 * Thin client for the `ListAttachments` webhook
 * (com.etendoerp.copilot.toolpack.webhooks.ListAttachmentsWebhook).
 *
 * Returns the AD_Attachment rows tied to a record, with each file's bytes
 * inlined as base64 — enough to render a PDF via the shared {@code PdfViewer}
 * without a second request.
 */

function detectEtendoBase() {
  const path = typeof window !== 'undefined' ? window.location.pathname : '';
  const webIdx = path.indexOf('/web/');
  if (webIdx !== -1) return path.substring(0, webIdx);
  return (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE) || '';
}

/**
 * Parse the envelope returned by the webhook. Shape:
 *   { message: '{"attachments":[{ id, name, createdDate, base64 }]}' }
 *
 * Returns an array (possibly empty) of attachment objects, never null. On any
 * parse error this returns [] so the caller can simply render "no attachments".
 *
 * Exported so unit tests can drive parsing without going through fetch.
 */
export function parseListAttachmentsEnvelope(envelope) {
  const raw = envelope?.message;
  if (!raw || typeof raw !== 'string') return [];
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  const list = Array.isArray(parsed?.attachments) ? parsed.attachments : [];
  return list.filter(item => item && item.id);
}

/**
 * Convert a base64 string to a browser Blob URL suitable for an <iframe>,
 * <embed>, or react-pdf <Document>. Caller is responsible for revoking the
 * URL via {@code URL.revokeObjectURL} when the document unmounts to avoid
 * leaking memory.
 *
 * Returns null when input is empty so callers can short-circuit gracefully.
 */
export function base64ToBlobUrl(base64, mimeType = 'application/pdf') {
  if (!base64) return null;
  // Decode in chunks to avoid hitting argument-limit on very large files.
  const byteString = atob(base64);
  const len = byteString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i += 1) bytes[i] = byteString.charCodeAt(i);
  const blob = new Blob([bytes], { type: mimeType });
  return URL.createObjectURL(blob);
}

/**
 * Fetch the attachments tied to (tabId, recordId) via the webhook. Returns an
 * array of `{ id, name, createdDate, base64 }`. Never throws — returns [] on
 * any error so the UI can stay simple.
 *
 * @param {{ token: string, tabId: string, recordId: string }} params
 */
export async function listAttachments({ token, tabId, recordId } = {}) {
  if (!token || !tabId || !recordId) return [];
  const qs = new URLSearchParams({
    name: 'ListAttachments',
    ADTabId: tabId,
    RecordId: recordId,
  });
  const url = `${detectEtendoBase()}/webhooks/?${qs.toString()}`;
  try {
    const res = await fetch(url, {
      method: 'GET',
      credentials: 'include',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return [];
    const envelope = await res.json().catch(() => null);
    return parseListAttachmentsEnvelope(envelope);
  } catch {
    return [];
  }
}

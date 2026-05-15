import { useState, useEffect, useRef, useCallback } from 'react';

export const ACCEPTED_TYPES = {
  'application/pdf': 'pdf',
  'image/jpeg': 'image',
  'image/jpg': 'image',
  'image/png': 'image',
  'image/gif': 'image',
  'image/webp': 'image',
  'image/svg+xml': 'image',
};
export const ACCEPT_ATTR = Object.keys(ACCEPTED_TYPES).join(',');

/**
 * usePreviewAttachment — GET / POST / DELETE against /sws/neo/preview-file.
 *
 * When storeCondition is false (or required params are missing) the hook is a
 * no-op: storedFile stays null and writes are silently skipped.
 *
 * On mount (when active): fires GET. If the file is found it is restored as a
 * Blob URL. If not found and sourceUrl is provided, GenericPreviewModal calls
 * storeUrl() to fetch and cache the file on first open.
 *
 * @param {Object} params
 * @param {string|null}  params.documentId     - PK of the source document
 * @param {string|null}  params.specName       - Spec identifier (e.g. 'sales-invoice')
 * @param {boolean}      params.storeCondition - false → no-op
 * @param {string|null}  params.token          - Bearer token
 * @param {string|null}  params.apiBaseUrl     - Window base URL (last segment stripped inside)
 */
export function usePreviewAttachment({
  documentId = null,
  specName = null,
  storeCondition = false,
  token = null,
  apiBaseUrl = null,
} = {}) {
  const [storedFile, setStoredFile] = useState(null);
  const [isBusy, setIsBusy] = useState(false);
  const [storeFailed, setStoreFailed] = useState(false);
  const objectUrlRef = useRef(null);

  const neoBase = apiBaseUrl ? apiBaseUrl.replace(/\/[^/]+$/, '') : null;
  const active = !!(storeCondition && documentId && specName && token && neoBase);

  const revokeUrl = useCallback(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  }, []);

  const applyBlob = useCallback((fileName, mimeType, blob) => {
    revokeUrl();
    const url = URL.createObjectURL(blob);
    objectUrlRef.current = url;
    setStoredFile({ fileName, mimeType, objectUrl: url });
  }, [revokeUrl]);

  // Restore from server on mount
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    setIsBusy(true);
    fetch(
      `${neoBase}/preview-file?specName=${encodeURIComponent(specName)}&recordId=${encodeURIComponent(documentId)}`,
      { headers: { Authorization: `Bearer ${token}` } },
    )
      .then(async (res) => {
        if (cancelled || !res.ok) return;
        const json = await res.json();
        if (cancelled || !json.fileData) return;
        const bytes = Uint8Array.from(atob(json.fileData), (c) => c.charCodeAt(0));
        applyBlob(json.fileName, json.mimeType, new Blob([bytes], { type: json.mimeType }));
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setIsBusy(false); });
    return () => { cancelled = true; };
  }, [active, neoBase, specName, documentId, token, applyBlob]);

  // Revoke Blob URL on unmount
  useEffect(() => () => revokeUrl(), [revokeUrl]);

  const postBlob = useCallback(async (blob, fileName, mimeType) => {
    if (!active) return;
    const base64 = await blobToBase64(blob);
    const res = await fetch(`${neoBase}/preview-file`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ specName, recordId: documentId, fileName, mimeType, fileData: base64 }),
    });
    if (!res.ok) throw new Error(`Store failed: HTTP ${res.status}`);
    applyBlob(fileName, mimeType, blob);
  }, [active, neoBase, token, specName, documentId, applyBlob]);

  const storeFile = useCallback(async (file) => {
    if (!active) return;
    setIsBusy(true);
    setStoreFailed(false);
    try {
      await postBlob(file, file.name, file.type);
    } catch {
      setStoreFailed(true);
    } finally {
      setIsBusy(false);
    }
  }, [active, postBlob]);

  const storeBlob = useCallback(async (blob, fileName) => {
    if (!active) return;
    setIsBusy(true);
    setStoreFailed(false);
    try {
      await postBlob(blob, fileName, blob.type || 'application/pdf');
    } catch {
      setStoreFailed(true);
    } finally {
      setIsBusy(false);
    }
  }, [active, postBlob]);

  const storeUrl = useCallback(async (url, fileName) => {
    if (!active) return;
    setIsBusy(true);
    setStoreFailed(false);
    try {
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error(`Fetch failed: HTTP ${res.status}`);
      const blob = await res.blob();
      await postBlob(blob, fileName, blob.type || 'application/pdf');
    } catch {
      setStoreFailed(true);
    } finally {
      setIsBusy(false);
    }
  }, [active, token, postBlob]);

  const deleteFile = useCallback(async () => {
    if (!active) return;
    await fetch(
      `${neoBase}/preview-file?specName=${encodeURIComponent(specName)}&recordId=${encodeURIComponent(documentId)}`,
      { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } },
    ).catch(() => {});
    revokeUrl();
    setStoredFile(null);
  }, [active, neoBase, specName, documentId, token, revokeUrl]);

  return { storedFile, isBusy, storeFailed, storeFile, storeBlob, storeUrl, deleteFile };
}

async function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

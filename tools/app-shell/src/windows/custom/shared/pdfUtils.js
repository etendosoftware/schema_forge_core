import { useState, useEffect, useRef } from 'react';
import { buildLocationAddressLines } from '@/lib/locationAddress.js';

// ---------------------------------------------------------------------------
// Shared Handlebars helpers (date + conditional — no fmt, which differs per doc)
// ---------------------------------------------------------------------------
export const COMMON_HANDLEBARS_HELPERS = `
function fmtDate(v) {
  if (!v) return '';
  var d = new Date(v);
  if (isNaN(d.getTime())) return String(v);
  return ('0'+d.getDate()).slice(-2)+'/'+('0'+(d.getMonth()+1)).slice(-2)+'/'+d.getFullYear();
}
function ifEq(a, b, opts) { return a === b ? opts.fn(this) : opts.inverse(this); }
`;

// ---------------------------------------------------------------------------
// Shared fetch helpers
// ---------------------------------------------------------------------------
export async function fetchJson(url, token) {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${url}`);
  const d = await res.json();
  return d?.response?.data?.[0] ?? d?.response?.data ?? d;
}

export async function fetchAll(url, token) {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  if (!res.ok) return [];
  const d = await res.json();
  return d?.response?.data ?? (Array.isArray(d) ? d : []);
}

export async function fetchOptionalJson(url, token) {
  try { return await fetchJson(url, token); } catch { return null; }
}

export async function fetchLocationAddress(locationId, base, token) {
  if (!locationId) return null;
  try {
    return await fetchJson(`${base}/contacts/locationAddress/${locationId}`, token);
  } catch { return null; }
}

export { buildLocationAddressLines };

export function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Failed to read company logo'));
    reader.readAsDataURL(blob);
  });
}

export async function fetchImageDataUrl(imageId, base, token) {
  if (!imageId) return null;
  try {
    const res = await fetch(`${base}/image/${imageId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    return await blobToDataUrl(await res.blob());
  } catch { return null; }
}

// ---------------------------------------------------------------------------
// Shared jsreport renderer (A4, chrome-pdf, handlebars)
// ---------------------------------------------------------------------------
export async function renderPdf(content, css, helpers, data) {
  const payload = {
    template: {
      content,
      engine: 'handlebars',
      recipe: 'chrome-pdf',
      helpers,
      chrome: {
        format: 'A4',
        landscape: false,
        marginTop: '0mm',
        marginBottom: '0mm',
        marginLeft: '0mm',
        marginRight: '0mm',
        printBackground: true,
      },
    },
    data: { css, ...data },
  };

  const res = await fetch('/jsreport/api/report', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`jsreport ${res.status}: ${text.slice(0, 300)}`);
  }

  return res.blob();
}

// ---------------------------------------------------------------------------
// Generic PDF hook — shared by all per-window pdf hooks
// ---------------------------------------------------------------------------
export function usePdfGenerator(recordId, apiBaseUrl, token, buildBlobFn) {
  const [pdfUrl, setPdfUrl] = useState(null);
  const [pdfBlob, setPdfBlob] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const prevUrlRef = useRef(null);
  const buildRef = useRef(buildBlobFn);
  buildRef.current = buildBlobFn;

  useEffect(() => {
    if (!recordId || !apiBaseUrl || !token) return;
    const base = apiBaseUrl.replace(/\/[^/]+$/, '');
    let cancelled = false;
    setLoading(true);
    setError(null);
    setPdfUrl(null);
    setPdfBlob(null);

    (async () => {
      try {
        const blob = await buildRef.current(recordId, base, token);
        if (cancelled) return;
        const url = URL.createObjectURL(blob);
        prevUrlRef.current = url;
        setPdfUrl(url);
        setPdfBlob(blob);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      setPdfBlob(null);
      if (prevUrlRef.current) {
        URL.revokeObjectURL(prevUrlRef.current);
        prevUrlRef.current = null;
      }
    };
  }, [recordId, apiBaseUrl, token]);

  return { pdfUrl, pdfBlob, loading, error };
}

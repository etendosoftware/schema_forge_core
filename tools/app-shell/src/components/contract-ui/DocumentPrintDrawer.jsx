import { useRef, useEffect, useState, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';

// Map window names to print report IDs
const PRINT_REPORT_MAP = {
  'purchase-order': 'print-purchase-order',
  // Future: 'sales-order': 'print-sales-order',
};

/**
 * Preview drawer: shows document preview one at a time with < > navigation.
 */
export default function DocumentPrintDrawer({ open, onClose, windowName, documentIds = [], token }) {
  const iframeRef = useRef(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const reportId = PRINT_REPORT_MAP[windowName];
  const total = documentIds.length;
  const currentDocId = documentIds[currentIndex];

  const renderDocument = useCallback(async (docId) => {
    if (!reportId || !docId || !token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/reports/${reportId}/render`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ format: 'html', params: { documentId: docId } }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
      const html = await res.text();
      const iframe = iframeRef.current;
      if (iframe) {
        iframe.src = 'about:blank';
        iframe.onload = () => {
          try { const doc = iframe.contentDocument; doc.open(); doc.write(html); doc.close(); } catch {}
          iframe.onload = null;
        };
      }
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  }, [reportId, token]);

  useEffect(() => { if (open && currentDocId) renderDocument(currentDocId); }, [open, currentDocId, renderDocument]);
  useEffect(() => { if (open) setCurrentIndex(0); }, [open]);

  if (!open || !reportId) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 bottom-0 w-[55%] max-w-3xl bg-white shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-200">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/30 bg-slate-50 shrink-0">
          <div className="flex items-center gap-3">
            {total > 1 && (
              <div className="flex items-center gap-1">
                <button onClick={() => setCurrentIndex(i => Math.max(0, i - 1))} disabled={currentIndex === 0} className="h-7 w-7 flex items-center justify-center rounded text-muted-foreground hover:text-foreground disabled:opacity-30">
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-xs font-medium text-muted-foreground tabular-nums">{currentIndex + 1} / {total}</span>
                <button onClick={() => setCurrentIndex(i => Math.min(total - 1, i + 1))} disabled={currentIndex === total - 1} className="h-7 w-7 flex items-center justify-center rounded text-muted-foreground hover:text-foreground disabled:opacity-30">
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
            {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </div>
          <button onClick={onClose} className="h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-hidden bg-slate-100 p-4">
          <div className="bg-white rounded-lg shadow-lg h-full overflow-hidden relative">
            {loading && <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10 gap-2 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /><span>Generating...</span></div>}
            {error && <div className="absolute inset-0 flex items-center justify-center bg-white/90 z-10 text-destructive text-sm px-8 text-center">{error}</div>}
            <iframe ref={iframeRef} title="Document Print" className="w-full h-full border-0" />
          </div>
        </div>
      </div>
    </>
  );
}

/**
 * Print all selected documents: generates a combined PDF and opens print dialog.
 * Call this function directly — no drawer needed.
 */
export async function printDocuments(windowName, documentIds, token) {
  const reportId = PRINT_REPORT_MAP[windowName];
  if (!reportId || !token || documentIds.length === 0) return;

  // Fetch HTML for each document
  const htmlParts = [];
  for (const docId of documentIds) {
    const res = await fetch(`/api/reports/${reportId}/render`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ format: 'html', params: { documentId: docId } }),
    });
    if (!res.ok) throw new Error(`Failed to render document`);
    htmlParts.push(await res.text());
  }

  // Combine with page breaks
  const combined = htmlParts.join('<div style="page-break-after: always;"></div>');

  // Generate PDF via jsreport
  const pdfRes = await fetch('/jsreport/api/report', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      template: {
        content: combined,
        engine: 'none',
        recipe: 'chrome-pdf',
        chrome: { format: 'A4', marginTop: '10mm', marginBottom: '10mm', marginLeft: '10mm', marginRight: '10mm' },
      },
      data: {},
    }),
  });

  if (!pdfRes.ok) throw new Error('PDF generation failed');
  const blob = await pdfRes.blob();
  const url = URL.createObjectURL(blob);

  // Open in new window for print dialog
  const printWin = window.open(url, '_blank');
  if (printWin) {
    printWin.onload = () => { printWin.print(); };
  }
}

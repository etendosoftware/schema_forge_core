import { useState, useEffect, useMemo } from 'react';
import ReturnWizard from './ReturnWizard';

/**
 * GoodsShipmentActions — topbarRight component for Goods Shipment detail view.
 *
 * Shows a "Create Return" button when the shipment is completed (CO).
 * Opens the ReturnWizard dialog to create a return receipt + credit note.
 *
 * Props received from DetailView: { data, recordId, token, apiBaseUrl, api }
 */
export default function GoodsShipmentActions({ data, recordId, token, apiBaseUrl, api }) {
  const [wizardOpen, setWizardOpen] = useState(false);
  const [lines, setLines] = useState([]);

  const isCompleted = data?.documentStatus === 'CO';

  const base = useMemo(() => (apiBaseUrl || '').replace(/\/[^/]+$/, ''), [apiBaseUrl]);
  const headers = useMemo(() => ({
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }), [token]);

  // Fetch shipment lines when wizard opens
  useEffect(() => {
    if (!wizardOpen || !recordId || !base) return;
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(
          `${base}/goods-shipment/goodsShipmentLine?parentId=${recordId}&_startRow=0&_endRow=200`,
          { headers },
        );
        if (!res.ok || cancelled) return;
        const json = await res.json();
        const fetchedLines = json?.response?.data || [];
        if (!cancelled) setLines(fetchedLines);
      } catch {
        // silent — wizard will show empty lines
      }
    })();

    return () => { cancelled = true; };
  }, [wizardOpen, recordId, base, headers]);

  if (!isCompleted) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setWizardOpen(true)}
        className="inline-flex items-center gap-1.5 text-[13px] font-medium border border-border text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
        style={{ padding: '4px 12px', borderRadius: '6px', borderWidth: '1px' }}
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M9 17H4a2 2 0 01-2-2V5a2 2 0 012-2h16a2 2 0 012 2v10a2 2 0 01-2 2h-5" />
          <path d="M12 15l-3 3 3 3" />
          <path d="M9 18h8" />
        </svg>
        Create Return
      </button>

      <ReturnWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        shipmentData={data}
        lines={lines}
        token={token}
        apiBaseUrl={apiBaseUrl}
        onSuccess={() => {
          setWizardOpen(false);
          // Reload page to reflect changes
          window.location.reload();
        }}
        onError={(msg) => {
          // Error is handled inside ReturnWizard; keep dialog open
          console.error('Return creation failed:', msg);
        }}
      />
    </>
  );
}

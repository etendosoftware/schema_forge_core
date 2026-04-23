import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button.jsx';
import { RotateCcw } from 'lucide-react';
import { useUI } from '@/i18n';
import { useDocumentAction } from '@/hooks/useDocumentAction';

/**
 * Bulk "Reactivate Order" button for the Sales Order list selection bar.
 * Only rendered when every selected row is in DocStatus = CO. Mixed selections
 * hide the button to enforce all-or-nothing semantics.
 */
export default function OrderReactivateBulkAction({ selectedRows, clearSelection, token, apiBaseUrl }) {
  const ui = useUI();
  const { execute } = useDocumentAction({ apiBaseUrl, entity: 'header', token });
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null); // { ok, failed: [{ documentNo, message }] }

  const allBooked = useMemo(
    () => selectedRows.length > 0 && selectedRows.every((r) => (r.documentStatus || r.docStatus) === 'CO'),
    [selectedRows],
  );

  if (!allBooked) return null;

  const handleClick = async () => {
    if (running) return;
    setRunning(true);
    setResult(null);

    const outcomes = await Promise.allSettled(
      selectedRows.map((row) => execute(row.id, 'RE').then(() => row)),
    );

    const failed = outcomes
      .map((o, i) => ({ o, row: selectedRows[i] }))
      .filter(({ o }) => o.status === 'rejected')
      .map(({ o, row }) => ({
        documentNo: row.documentNo || row.id,
        message: o.reason?.message || 'Unknown error',
      }));
    const ok = outcomes.length - failed.length;

    setResult({ ok, failed });
    setRunning(false);

    if (failed.length === 0) {
      clearSelection();
      setTimeout(() => window.location.reload(), 600);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5"
        onClick={handleClick}
        disabled={running}
      >
        <RotateCcw className="h-3.5 w-3.5" />
        {ui('reactivateOrder')} ({selectedRows.length})
      </Button>

      {result && result.failed.length > 0 && (
        <div
          role="alert"
          className="absolute right-4 top-full mt-2 z-50 w-80 rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700 shadow-lg"
        >
          <div className="font-medium mb-1">
            {ui('reactivatePartial')
              .replace('{ok}', String(result.ok))
              .replace('{total}', String(result.ok + result.failed.length))}
          </div>
          <ul className="list-disc pl-4 space-y-0.5">
            {result.failed.map((f, i) => (
              <li key={i}>
                <span className="font-medium">{f.documentNo}</span>: {f.message}
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => setResult(null)}
            className="mt-2 text-[11px] font-medium underline opacity-70 hover:opacity-100"
          >
            {ui('close')}
          </button>
        </div>
      )}
    </>
  );
}

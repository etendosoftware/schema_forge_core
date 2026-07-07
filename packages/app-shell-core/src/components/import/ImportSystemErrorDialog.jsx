import { useState } from 'react';
import { toast } from 'sonner';
import { CircleAlert, ChevronDown, ChevronRight } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog.jsx';
import { Button } from '../ui/button.jsx';

const DEFAULT_LABELS = {
  title: 'Unexpected system error',
  subtitle: 'This is a raw backend message, not a validation error — copy it and share it with support.',
  copy: 'Copy full report',
  copied: 'Copied to clipboard',
  copyFailed: 'Could not copy to clipboard',
  close: 'Close',
  showReport: 'View full report',
  hideReport: 'Hide full report',
  rowData: 'Row data',
  requestSent: 'Request sent',
  serverResponse: 'Server response',
};

function safeJson(value) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

/**
 * Full-report plain text for the clipboard — everything needed to file a support
 * ticket without the user having to dig through the Network tab: which row, what was
 * actually sent, and the raw server response, not just the summary message.
 */
function buildReportText({ message, row, operations, raw }) {
  const parts = [`Error: ${message}`];
  if (row) parts.push(`Row data:\n${safeJson(row)}`);
  if (operations) parts.push(`Request sent:\n${safeJson(operations)}`);
  if (raw) parts.push(`Server response:\n${raw}`);
  return parts.join('\n\n');
}

/**
 * Blocking, own-Dialog surface for the last uncontrolled/system-level failure of an
 * import run — separate from the per-row review queue (ImportReviewQueue), which stays
 * focused on "which rows still need attention". This exists for the current debugging
 * phase of the backend integration: instead of hunting a raw server message out of a
 * small per-row cell (or the Network tab), the last failure's full context — which row,
 * the exact request sent, and the raw server response — is one click away. The message
 * alone is shown up front; row/request/response are collapsed behind "View full report"
 * by default, per explicit request, so the dialog isn't a wall of JSON on every failure.
 * Stacks on top of ImportDialog's own Dialog (Radix supports nested open dialogs via
 * portals) so the Result step's review queue is still there, underneath, once dismissed.
 */
export function ImportSystemErrorDialog({ open, message, row, operations, raw, onClose, labels }) {
  const text = { ...DEFAULT_LABELS, ...labels };
  const [showReport, setShowReport] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(buildReportText({ message, row, operations, raw }));
      toast.success(text.copied);
    } catch {
      toast.error(text.copyFailed);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => { if (!next) onClose(); }}
      data-testid="Dialog__a7c9a4">
      <DialogContent className="max-w-2xl" data-testid="DialogContent__a7c9a4">
        <DialogHeader data-testid="DialogHeader__a7c9a4">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
            <CircleAlert className="h-5 w-5" data-testid="CircleAlert__a7c9a4" />
          </span>
          <DialogTitle data-testid="ImportSystemErrorDialog__title">{text.title}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground" data-testid="ImportSystemErrorDialog__subtitle">{text.subtitle}</p>
        <p className="text-sm text-destructive font-medium" data-testid="ImportSystemErrorDialog__message">{message}</p>

        <button
          type="button"
          className="flex items-center gap-1 text-xs text-primary underline w-fit"
          onClick={() => setShowReport((v) => !v)}
          data-testid="ImportSystemErrorDialog__toggleReport"
        >
          {showReport ? <ChevronDown className="h-3 w-3" data-testid="ChevronDown__a7c9a4" /> : <ChevronRight className="h-3 w-3" data-testid="ChevronRight__a7c9a4" />}
          {showReport ? text.hideReport : text.showReport}
        </button>

        {showReport && (
          <div className="flex flex-col gap-3" data-testid="ImportSystemErrorDialog__report">
            {row && (
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium text-muted-foreground">{text.rowData}</span>
                <pre
                  className="max-h-40 overflow-auto rounded bg-muted p-3 text-xs whitespace-pre-wrap break-all"
                  data-testid="ImportSystemErrorDialog__row"
                >
                  {safeJson(row)}
                </pre>
              </div>
            )}
            {operations && (
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium text-muted-foreground">{text.requestSent}</span>
                <pre
                  className="max-h-40 overflow-auto rounded bg-muted p-3 text-xs whitespace-pre-wrap break-all"
                  data-testid="ImportSystemErrorDialog__request"
                >
                  {safeJson(operations)}
                </pre>
              </div>
            )}
            {raw && (
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium text-muted-foreground">{text.serverResponse}</span>
                <pre
                  className="max-h-64 overflow-auto rounded bg-muted p-3 text-xs whitespace-pre-wrap break-all"
                  data-testid="ImportSystemErrorDialog__trace"
                >
                  {raw}
                </pre>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2 mt-2">
          <Button type="button" variant="secondary" onClick={handleCopy} data-testid="ImportSystemErrorDialog__copy">
            {text.copy}
          </Button>
          <Button type="button" onClick={onClose} data-testid="ImportSystemErrorDialog__close">
            {text.close}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

import { toast } from 'sonner';
import { CircleAlert } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog.jsx';
import { Button } from '../ui/button.jsx';

const DEFAULT_LABELS = {
  title: 'Unexpected system error',
  subtitle: 'This is a raw backend message, not a validation error — copy it and share it with support.',
  copy: 'Copy error',
  copied: 'Copied to clipboard',
  copyFailed: 'Could not copy to clipboard',
  close: 'Close',
};

/**
 * Blocking, own-Dialog surface for the last uncontrolled/system-level failure of an
 * import run — separate from the per-row review queue (ImportReviewQueue), which stays
 * focused on "which rows still need attention". This exists for the current debugging
 * phase of the backend integration: instead of hunting a raw server message out of a
 * small per-row cell (or the Network tab), the last failure's full message and raw
 * trace/detail are front-and-center the moment send completes. Stacks on top of
 * ImportDialog's own Dialog (Radix supports nested open dialogs via portals) so the
 * Result step's review queue is still there, underneath, once this is dismissed.
 */
export function ImportSystemErrorDialog({ open, message, raw, onClose, labels }) {
  const text = { ...DEFAULT_LABELS, ...labels };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(raw ? `${message}\n\n${raw}` : message);
      toast.success(text.copied);
    } catch {
      toast.error(text.copyFailed);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
            <CircleAlert className="h-5 w-5" />
          </span>
          <DialogTitle data-testid="ImportSystemErrorDialog__title">{text.title}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground" data-testid="ImportSystemErrorDialog__subtitle">{text.subtitle}</p>
        <p className="text-sm text-destructive font-medium" data-testid="ImportSystemErrorDialog__message">{message}</p>
        {raw && (
          <pre
            className="max-h-64 overflow-auto rounded bg-muted p-3 text-xs whitespace-pre-wrap break-all"
            data-testid="ImportSystemErrorDialog__trace"
          >
            {raw}
          </pre>
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

import { TriangleAlert } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog.jsx';
import { Button } from '../ui/button.jsx';

const DEFAULT_LABELS = {
  title: 'The import is still running',
  body: 'Closing this window does not cancel it. The rows already queued keep being created in the '
    + 'background, and you will only be told how many failed, not which ones.',
  keepWatching: 'Keep watching',
  closeAnyway: 'Close anyway',
};

/**
 * ETP-5225 — what the "X" means while the import is sending.
 *
 * Clicking it used to close the progress modal outright, which reads as "cancel": the dialog
 * vanished, nothing said anything, and the products kept being created. A user who closed it to
 * stop a mistaken import found the records there after a reload.
 *
 * The send genuinely CANNOT be cancelled at this point — every row is its own `/batch` call and
 * the ones already accepted are committed — so this does not offer a cancel it cannot honour.
 * It states what closing actually does and makes the user choose, which is the second of the two
 * remedies the ticket asks for. Staying is the default action: it is the one that loses nothing.
 *
 * Deliberately NOT a hard block on closing. An import runs up to `limit.maxRows` (5000) rows at
 * concurrency 4, so refusing to close could trap the user in a modal for minutes with no way out.
 */
export function ImportSendingCloseDialog({ open, onKeepWatching, onCloseAnyway, labels }) {
  const text = { ...DEFAULT_LABELS, ...labels };

  return (
    <Dialog
      open={open}
      // Escape and an outside click land here too, and both mean "I did not choose" — so they
      // dismiss this question and leave the import's own dialog exactly where it was, rather
      // than falling through to closing the thing this dialog exists to ask about.
      onOpenChange={(next) => { if (!next) onKeepWatching(); }}
      data-testid="Dialog__sendingClose">
      <DialogContent className="max-w-md" data-testid="DialogContent__sendingClose">
        <DialogHeader data-testid="DialogHeader__sendingClose">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600">
            <TriangleAlert className="h-5 w-5" data-testid="TriangleAlert__sendingClose" />
          </span>
          <DialogTitle data-testid="ImportSendingCloseDialog__title">{text.title}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground" data-testid="ImportSendingCloseDialog__body">{text.body}</p>
        <DialogFooter data-testid="DialogFooter__sendingClose">
          <Button
            type="button"
            variant="outline"
            onClick={onCloseAnyway}
            data-testid="ImportSendingCloseDialog__closeAnyway"
          >
            {text.closeAnyway}
          </Button>
          <Button
            type="button"
            onClick={onKeepWatching}
            data-testid="ImportSendingCloseDialog__keepWatching"
          >
            {text.keepWatching}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

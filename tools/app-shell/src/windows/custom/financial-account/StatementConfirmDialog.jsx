import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useUI } from '@/i18n';

/**
 * Confirmation dialog shared by the "Process" and "Delete" row actions of an
 * imported statement. The copy and the confirm button's tone switch on
 * {@code variant}; deletion is destructive.
 *
 * @param {{
 *   variant: 'process' | 'delete' | null,
 *   statement: object | null,
 *   busy: boolean,
 *   onConfirm: () => void,
 *   onClose: () => void,
 * }} props
 */
export function StatementConfirmDialog({ variant, statement, busy, onConfirm, onClose }) {
  const ui = useUI();
  const open = variant != null && statement != null;
  const isDelete = variant === 'delete';
  const name = statement?.name || statement?.documentNo || '';

  const title = ui(isDelete
    ? 'financeAccountStatementsDeleteTitle'
    : 'financeAccountStatementsProcessTitle');
  const body = ui(isDelete
    ? 'financeAccountStatementsDeleteBody'
    : 'financeAccountStatementsProcessBody', { name });
  const confirmLabel = ui(isDelete
    ? 'financeAccountStatementsDeleteConfirm'
    : 'financeAccountStatementsProcessConfirm');

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md" data-testid="statement-confirm-dialog">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{body}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            {ui('financeAccountStatementsManualCancel')}
          </Button>
          <Button
            variant={isDelete ? 'destructive' : 'default'}
            onClick={onConfirm}
            disabled={busy}
            data-testid="statement-confirm-action"
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose,
} from '@/components/ui/dialog.jsx';
import { Button } from '@/components/ui/button.jsx';
import { buildHeaders } from '@/auth/api';
import { useUI } from '@/i18n';
import { extractErrorMessage } from '@/hooks/useEntity';

/**
 * Row-level delete with the same styled confirm modal DetailView uses
 * (ui('deleteConfirmTitle') / ui('deleteConfirmMessage') / Dialog primitive).
 *
 * Returns:
 *   - requestDelete(row): opens the dialog for that row — wire as `onDelete` on RowQuickActions.
 *   - deleteDialog: JSX node the host must render once (e.g. before its modals/portals).
 *
 * On confirm: DELETE ${apiBaseUrl}/${entity}/${row.id} → toast + onSuccess refresh.
 */
export function useRowDelete({ apiBaseUrl, entity = 'header', token, onSuccess }) {
  const ui = useUI();
  const [pending, setPending] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const requestDelete = useCallback((row) => {
    if (!row?.id) return;
    setPending(row);
  }, []);

  const close = useCallback(() => {
    if (deleting) return;
    setPending(null);
  }, [deleting]);

  const confirm = useCallback(async () => {
    if (!pending?.id || !apiBaseUrl) return;
    setDeleting(true);
    try {
      const res = await fetch(`${apiBaseUrl}/${entity}/${pending.id}`, {
        method: 'DELETE',
        headers: buildHeaders(token),
      });
      if (res.ok) {
        toast.success(ui('recordDeleted'));
        setPending(null);
        onSuccess?.();
      } else {
        const msg = await extractErrorMessage(res, ui);
        toast.error(msg || `${res.status} ${res.statusText}`);
      }
    } catch (err) {
      toast.error(err?.message || ui('networkError'));
    } finally {
      setDeleting(false);
    }
  }, [pending, apiBaseUrl, entity, token, onSuccess, ui]);

  const deleteDialog = (
    <Dialog open={Boolean(pending)} onOpenChange={(open) => { if (!open) close(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{ui('deleteConfirmTitle')}</DialogTitle>
          <DialogDescription>{ui('deleteConfirmMessage')}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" size="sm" disabled={deleting}>{ui('cancel')}</Button>
          </DialogClose>
          <Button
            variant="destructive"
            size="sm"
            disabled={deleting}
            data-testid="row-quick-action-delete-confirm"
            onClick={confirm}
          >
            {ui('delete')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return { requestDelete, deleteDialog };
}

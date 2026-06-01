import { useState } from 'react';
import { toast } from 'sonner';
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
import { useAccountMutations } from '@/hooks/useAccountMutations.js';

/**
 * Confirmation dialog for archiving (soft-deleting) a financial account (ETP-4096).
 * The backend rejects with HTTP 409 when the account has open reconciliations; that
 * case surfaces a specific message.
 */
export function ArchiveAccountDialog({ open, onClose, onArchived, account }) {
  const ui = useUI();
  const { archiveAccount } = useAccountMutations();
  const [submitting, setSubmitting] = useState(false);

  if (!account) return null;

  const handleConfirm = async () => {
    setSubmitting(true);
    try {
      await archiveAccount(account.id);
      toast.success(ui('financeAccountsArchiveSuccess'));
      onArchived?.();
      onClose?.();
    } catch (err) {
      const message = err.status === 409
        ? ui('financeAccountsArchiveOpenRecon')
        : (err.message || ui('financeAccountsArchiveError'));
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(value) => { if (!value) onClose?.(); }}>
      <DialogContent className="max-w-md" data-testid="archive-account-dialog">
        <DialogHeader>
          <DialogTitle>{ui('financeAccountsArchiveConfirmTitle')}</DialogTitle>
          <DialogDescription>{ui('financeAccountsArchiveConfirmBody')}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            {ui('financeAccountsArchiveCancel')}
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={submitting}
            data-testid="archive-account-confirm"
          >
            {ui('financeAccountsArchiveConfirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useUI } from '@/i18n';
import { useAccountMutations } from '@/hooks/useAccountMutations.js';
import { ACCOUNT_TYPE } from '@/components/financial-accounts/tokens';
import { AccountFormStep } from './AccountFormStep.jsx';

/**
 * Edit the general data of a financial account (ETP-4096). Reuses
 * {@link AccountFormStep} for Name / IBAN / Currency (BIC is hidden — the list
 * endpoint does not carry it and the backend leaves omitted fields untouched).
 * The "Conexión bancaria" (PSD2) section is rendered disabled — wired by T3.
 */
export function EditAccountModal({ open, onClose, onSaved, account }) {
  const ui = useUI();
  const { updateAccount, fetchDefaults } = useAccountMutations();
  const [currencies, setCurrencies] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return undefined;
    setSubmitting(false);
    setError(null);
    let cancelled = false;
    fetchDefaults()
      .then((data) => {
        if (!cancelled) setCurrencies(Array.isArray(data.currencies) ? data.currencies : []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [open, fetchDefaults]);

  if (!account) return null;

  const isBank = account.type !== ACCOUNT_TYPE.CASH;

  const handleSave = async (values) => {
    setSubmitting(true);
    setError(null);
    try {
      await updateAccount(account.id, values);
      toast.success(ui('financeAccountsEditSuccess'));
      onSaved?.();
      onClose?.();
    } catch (err) {
      if (err.status === 409) {
        setError(ui('financeAccountsNewNameExists'));
      } else {
        toast.error(err.message || ui('financeAccountsEditError'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => { if (!value) onClose?.(); }}
      data-testid="Dialog__73027d">
      <DialogContent className="bg-white" data-testid="edit-account-modal">
        <DialogHeader data-testid="DialogHeader__73027d">
          <DialogTitle data-testid="DialogTitle__73027d">{ui('financeAccountsEditTitle')}</DialogTitle>
        </DialogHeader>

        <p className="text-sm font-medium text-[#121217]">{ui('financeAccountsEditDataSection')}</p>
        <AccountFormStep
          mode={isBank ? 'bank' : 'cash'}
          currencies={currencies}
          showBic={false}
          initialValues={{
            name: account.name ?? '',
            iban: account.iban ?? '',
            currencyId: account.currencyId ?? '',
          }}
          submitLabel={ui('financeAccountsEditSave')}
          submitting={submitting}
          error={error}
          onSubmit={handleSave}
          data-testid="AccountFormStep__73027d" />
      </DialogContent>
    </Dialog>
  );
}

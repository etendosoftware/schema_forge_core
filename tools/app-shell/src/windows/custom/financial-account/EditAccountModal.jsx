import { useEffect, useState } from 'react';
import { Link2 } from 'lucide-react';
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
    <Dialog open={open} onOpenChange={(value) => { if (!value) onClose?.(); }}>
      <DialogContent data-testid="edit-account-modal">
        <DialogHeader>
          <DialogTitle>{ui('financeAccountsEditTitle')}</DialogTitle>
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
        />

        {isBank ? (
          <div
            className="mt-2 rounded-lg border border-dashed border-[#D1D4DB] bg-[#F5F7F9] p-3 opacity-70"
            data-testid="edit-account-connection-disabled"
          >
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-sm font-medium text-[#6C6C89]">
                <Link2 className="h-4 w-4" />
                {ui('financeAccountsEditConnectionSection')}
              </span>
              <span className="rounded-full bg-[#E8EAEF] px-2 py-0.5 text-xs font-normal text-[#6C6C89]">
                {ui('financeAccountsEditConnectionSoon')}
              </span>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

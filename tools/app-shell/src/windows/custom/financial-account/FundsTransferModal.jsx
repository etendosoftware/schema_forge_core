import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useUI } from '@/i18n';
import { useFinancialAccounts } from '@/hooks/useFinancialAccounts.js';
import { useFundsTransfer } from '@/hooks/useCreateMovement';
import { useGLItemLookup } from '@/hooks/useMovementLookups';
import {
  Field, ReadOnly, Select, AmountInput, TextInput, LookupPicker,
} from '@/components/forms/fields';

/** Parses a user-typed amount ("1.234,56" or "1234.56") into a Number, or NaN. */
function parseAmount(raw) {
  if (raw == null || String(raw).trim() === '') return NaN;
  const normalized = String(raw).replace(/\./g, '').replace(',', '.');
  // If there were no thousands separators the strip above is a no-op for "1234.56".
  const n = Number(/[.,]/.test(String(raw)) ? normalized : raw);
  return Number.isFinite(n) ? n : Number(raw);
}

/**
 * Funds Transfer between financial accounts (ETP-4272) — single-step modal.
 *
 * The source account is pre-filled (read-only) with the account the action started from; the
 * destination lists the other accounts of the organization. On confirm the backend
 * ({@code financial-account-transactions?action=transfer}) delegates to Etendo Classic, creating the
 * paired withdrawal/deposit (+ optional bank-fee) transactions, left Pending until reconciled.
 *
 * Mounted == open: the parent renders it only while the transfer is active and unmounts on close.
 *
 * @param {{ sourceAccountId: string, onClose: () => void, onSuccess?: () => void }} props
 */
export function FundsTransferModal({ sourceAccountId, onClose, onSuccess }) {
  const ui = useUI();
  const { accounts } = useFinancialAccounts();
  const { transfer, transferring } = useFundsTransfer();

  const [destId, setDestId] = useState('');
  const [glItem, setGlItem] = useState(null);
  const [amount, setAmount] = useState('');
  const [conversionRate, setConversionRate] = useState('');
  const [bankFee, setBankFee] = useState(false);
  const [bankFeeAmount, setBankFeeAmount] = useState('');
  const [description, setDescription] = useState(() => ui('financeAccountTransferDescriptionDefault'));
  const [error, setError] = useState(null);

  const source = useMemo(
    () => accounts.find((a) => a.id === sourceAccountId) ?? null,
    [accounts, sourceAccountId],
  );
  const destOptions = useMemo(
    () => accounts
      .filter((a) => a.id !== sourceAccountId && a.active !== false)
      .map((a) => ({ value: a.id, label: a.name })),
    [accounts, sourceAccountId],
  );
  const dest = useMemo(() => accounts.find((a) => a.id === destId) ?? null, [accounts, destId]);
  const multiCurrency = !!(source && dest && dest.currencyId !== source.currencyId);

  const amountNum = parseAmount(amount);
  const available = Number(source?.currentBalance ?? 0);
  const overBalance = Number.isFinite(amountNum) && amountNum > available;
  const rateNum = parseAmount(conversionRate);
  const canSubmit = !!destId
    && Number.isFinite(amountNum) && amountNum > 0
    && !overBalance
    && (!multiCurrency || (Number.isFinite(rateNum) && rateNum > 0))
    && !transferring;

  const handleConfirm = async () => {
    setError(null);
    if (destId === sourceAccountId) {
      setError(ui('financeAccountTransferErrorSameAccount'));
      return;
    }
    if (overBalance) {
      setError(ui('financeAccountTransferErrorBalance'));
      return;
    }
    const payload = {
      sourceAccountId,
      destinationAccountId: destId,
      amount: String(amountNum),
      description,
      bankFee,
    };
    if (glItem?.id) payload.glItemId = glItem.id;
    if (multiCurrency) payload.conversionRate = String(rateNum);
    if (bankFee) payload.bankFeeAmount = String(parseAmount(bankFeeAmount) || 0);

    try {
      await transfer(payload);
      toast.success(ui('financeAccountTransferSuccess'));
      onSuccess?.();
      onClose?.();
    } catch (err) {
      setError(err?.message || ui('financeAccountTransferError'));
    }
  };

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose?.(); }} data-testid="Dialog__transfer">
      <DialogContent className="bg-white" data-testid="funds-transfer-modal">
        <DialogHeader data-testid="DialogHeader__transfer">
          <DialogTitle data-testid="DialogTitle__transfer">
            {ui('financeAccountTransferTitle')}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <Field label={ui('financeAccountTransferSource')} data-testid="Field__transfer-source">
            <ReadOnly data-testid="ReadOnly__transfer-source">{source?.name ?? ''}</ReadOnly>
          </Field>

          <Select
            label={ui('financeAccountTransferDestination')}
            required
            value={destId}
            onChange={setDestId}
            options={destOptions}
            placeholder={ui('financeAccountTransferDestinationPlaceholder')}
            name="transfer-destination"
            data-testid="Select__transfer-destination" />

          <Field label={ui('financeAccountTransferGlItem')} data-testid="Field__transfer-glitem">
            <LookupPicker
              value={glItem}
              onChange={setGlItem}
              useLookup={useGLItemLookup}
              placeholder={ui('financeAccountTransferGlItemPlaceholder')}
              data-testid="LookupPicker__transfer-glitem" />
          </Field>

          <div className="flex gap-3">
            <AmountInput
              label={ui('financeAccountTransferAmount')}
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="flex-1"
              name="transfer-amount"
              data-testid="AmountInput__transfer-amount" />
            <Field
              label={ui('financeAccountTransferCurrencyFrom')}
              className="w-28"
              data-testid="Field__transfer-currency-from">
              <ReadOnly data-testid="ReadOnly__transfer-currency-from">
                {source?.currencyIso ?? ''}
              </ReadOnly>
            </Field>
          </div>

          {multiCurrency ? (
            <div className="flex gap-3">
              <Field
                label={ui('financeAccountTransferCurrencyTo')}
                className="w-28"
                data-testid="Field__transfer-currency-to">
                <ReadOnly data-testid="ReadOnly__transfer-currency-to">
                  {dest?.currencyIso ?? ''}
                </ReadOnly>
              </Field>
              <Field
                label={ui('financeAccountTransferRate')}
                required
                className="flex-1"
                data-testid="Field__transfer-rate">
                <TextInput
                  name="transfer-rate"
                  inputMode="decimal"
                  value={conversionRate}
                  onChange={(e) => setConversionRate(e.target.value)}
                  data-testid="TextInput__transfer-rate" />
              </Field>
            </div>
          ) : null}

          <label
            className="flex items-center gap-2 text-sm font-medium text-[#121217]"
            data-testid="label__transfer-bankfee">
            <input
              type="checkbox"
              checked={bankFee}
              onChange={(e) => setBankFee(e.target.checked)}
              data-testid="checkbox-transfer-bankfee" />
            {ui('financeAccountTransferBankFee')}
          </label>
          {bankFee ? (
            <AmountInput
              label={ui('financeAccountTransferBankFeeAmount')}
              value={bankFeeAmount}
              onChange={(e) => setBankFeeAmount(e.target.value)}
              name="transfer-bankfee-amount"
              data-testid="AmountInput__transfer-bankfee" />
          ) : null}

          <Field
            label={ui('financeAccountTransferDescription')}
            data-testid="Field__transfer-description">
            <TextInput
              name="transfer-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              data-testid="TextInput__transfer-description" />
          </Field>

          {overBalance ? (
            <p className="text-sm text-[#D50B3E]" data-testid="transfer-balance-warning">
              {ui('financeAccountTransferErrorBalance')}
            </p>
          ) : null}
          {error ? (
            <p className="text-sm text-[#D50B3E]" data-testid="transfer-error">{error}</p>
          ) : null}
        </div>

        <div className="mt-2 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => onClose?.()}
            data-testid="transfer-cancel"
            className="inline-flex h-10 items-center rounded-lg border border-[#D1D4DB] bg-white px-4 text-sm font-medium text-[#3F3F50] hover:bg-[#F5F7F9]"
          >
            {ui('financeAccountTransferCancel')}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!canSubmit}
            data-testid="transfer-confirm"
            className="inline-flex h-10 items-center rounded-lg bg-[#121217] px-4 text-sm font-semibold text-white hover:bg-[#282833] disabled:opacity-50 disabled:pointer-events-none"
          >
            {ui('financeAccountTransferConfirm')}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

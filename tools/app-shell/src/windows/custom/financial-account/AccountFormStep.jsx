import { useEffect, useState } from 'react';
import { Landmark } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { useUI } from '@/i18n';
import { isValidIban, normalizeIban } from '@/lib/validateIban.js';

const EMPTY = { name: '', iban: '', swiftCode: '', currencyId: '' };

/**
 * Reusable account form for the offline flow (ETP-4096). Used both by the New
 * Account wizard (bank/cash creation) and the Edit Account modal.
 *
 * - `mode='bank'` shows IBAN + BIC/SWIFT; `mode='cash'` shows only Name + Currency.
 * - Name is required; IBAN is optional but, when present, must pass mod-97.
 * - `onSubmit` receives `{ name, type, currencyId, iban, swiftCode }` (iban/swift
 *   are normalised and only included for bank accounts).
 */
export function AccountFormStep({
  mode = 'bank',
  bankName,
  currencies = [],
  defaultCurrencyId,
  initialValues,
  submitLabel,
  submitting = false,
  error = null,
  showBic = true,
  onSubmit,
}) {
  const ui = useUI();
  const seed = { ...EMPTY, ...(initialValues || {}) };
  const [name, setName] = useState(seed.name);
  const [iban, setIban] = useState(seed.iban);
  const [swiftCode, setSwiftCode] = useState(seed.swiftCode);
  const [currencyId, setCurrencyId] = useState(seed.currencyId || defaultCurrencyId || '');
  const [ibanTouched, setIbanTouched] = useState(false);

  useEffect(() => {
    if (!currencyId && defaultCurrencyId) setCurrencyId(defaultCurrencyId);
  }, [defaultCurrencyId, currencyId]);

  const isBank = mode === 'bank';
  const ibanInvalid = isBank && iban.trim() !== '' && !isValidIban(iban);
  const canSubmit = name.trim() !== '' && currencyId !== '' && !ibanInvalid && !submitting;

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!canSubmit) return;
    const payload = { name: name.trim(), type: isBank ? 'B' : 'C', currencyId };
    if (isBank) {
      payload.iban = normalizeIban(iban);
      // Only emit swiftCode when the field is shown — the edit modal hides it and
      // the backend leaves a missing key untouched, preserving the stored value.
      if (showBic) payload.swiftCode = swiftCode.trim().toUpperCase();
    }
    onSubmit?.(payload);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" data-testid="account-form">
      {isBank && bankName ? (
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#E8EAEF] text-[#828FA3]">
            <Landmark className="h-4 w-4" />
          </span>
          <span className="text-sm font-semibold text-[#121217]">{bankName}</span>
        </div>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="account-form-name-input">
          {ui('financeAccountsNewFieldName')} <span className="text-[#D50B3E]">*</span>
        </Label>
        <Input
          id="account-form-name-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={60}
          autoFocus
          data-testid="account-form-name"
        />
      </div>

      {isBank ? (
        <>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="account-form-iban-input">{ui('financeAccountsNewFieldIban')}</Label>
            <Input
              id="account-form-iban-input"
              value={iban}
              onChange={(e) => setIban(e.target.value)}
              onBlur={() => setIbanTouched(true)}
              placeholder={ui('financeAccountsNewFieldIbanPlaceholder')}
              maxLength={42}
              data-testid="account-form-iban"
            />
            {ibanInvalid && ibanTouched ? (
              <p className="text-xs text-[#D50B3E]" data-testid="account-form-iban-error">
                {ui('financeAccountsNewIbanInvalid')}
              </p>
            ) : null}
          </div>

          {showBic ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="account-form-bic-input">{ui('financeAccountsNewFieldBic')}</Label>
              <Input
                id="account-form-bic-input"
                value={swiftCode}
                onChange={(e) => setSwiftCode(e.target.value)}
                placeholder={ui('financeAccountsNewFieldBicPlaceholder')}
                maxLength={20}
                data-testid="account-form-bic"
              />
            </div>
          ) : null}
        </>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="account-form-currency-trigger">{ui('financeAccountsNewFieldCurrency')}</Label>
        <Select value={currencyId} onValueChange={setCurrencyId}>
          <SelectTrigger id="account-form-currency-trigger" data-testid="account-form-currency">
            <SelectValue placeholder={ui('financeAccountsNewFieldCurrencyPlaceholder')} />
          </SelectTrigger>
          <SelectContent>
            {currencies.map((currency) => (
              <SelectItem key={currency.id} value={currency.id}>
                {currency.iso}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {error ? (
        <p className="text-xs text-[#D50B3E]" data-testid="account-form-error">
          {error}
        </p>
      ) : null}

      <div className="flex justify-end pt-2">
        <Button
          type="submit"
          disabled={!canSubmit}
          data-testid="account-form-submit"
          className="h-10 gap-1 rounded-lg bg-[#121217] px-4 text-sm font-medium text-white transition-colors hover:bg-[#FFD500] hover:text-[#121217] disabled:opacity-50"
        >
          {submitLabel || ui('financeAccountsNewSubmit')}
        </Button>
      </div>
    </form>
  );
}

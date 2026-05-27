import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Landmark,
  Wallet,
  CreditCard,
  Search,
  ChevronRight,
  Plus,
  Link2,
  PencilLine,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useUI } from '@/i18n';
import { useAccountMutations } from '@/hooks/useAccountMutations.js';
import { AccountFormStep } from './AccountFormStep.jsx';
import { searchBanks, institutionsFor } from './bankCatalog.js';

const STEP = {
  TYPE: 'type',
  CONNECTION: 'connection',
  BANK: 'bank',
  INSTITUTION: 'institution',
  FORM: 'form',
  CARD: 'card',
};

/**
 * Multi-step modal to create a financial account "offline" (ETP-4096):
 *   type picker → (Bank) connection toggle → bank picker → institution → form
 *   Caja goes straight to a simple form; Tarjeta shows a "coming soon" placeholder.
 *
 * Props:
 *   - open: controls visibility
 *   - onClose(): called when the dialog should close
 *   - onCreated(): called after a successful create so the caller can reload the list
 */
export function NewAccountWizard({ open, onClose, onCreated }) {
  const ui = useUI();
  const { createAccount, fetchDefaults } = useAccountMutations();

  const [step, setStep] = useState(STEP.TYPE);
  const [accountType, setAccountType] = useState(null);
  const [selectedBank, setSelectedBank] = useState(null);
  const [bankQuery, setBankQuery] = useState('');
  const [currencies, setCurrencies] = useState([]);
  const [defaultCurrencyId, setDefaultCurrencyId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

  useEffect(() => {
    if (!open) return undefined;
    setStep(STEP.TYPE);
    setAccountType(null);
    setSelectedBank(null);
    setBankQuery('');
    setSubmitting(false);
    setFormError(null);
    let cancelled = false;
    fetchDefaults()
      .then((data) => {
        if (cancelled) return;
        setCurrencies(Array.isArray(data.currencies) ? data.currencies : []);
        setDefaultCurrencyId(data.defaultCurrencyId || '');
      })
      .catch(() => {
        if (!cancelled) toast.error(ui('financeAccountsNewCreateError'));
      });
    return () => {
      cancelled = true;
    };
    // Re-run only when the dialog opens (or the fetcher changes); `ui` is read in
    // the catch but must not retrigger the reset/refetch and wipe wizard progress.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, fetchDefaults]);

  const goBack = () => {
    setFormError(null);
    if (step === STEP.CONNECTION || step === STEP.CARD) setStep(STEP.TYPE);
    else if (step === STEP.BANK) setStep(STEP.CONNECTION);
    else if (step === STEP.INSTITUTION) setStep(STEP.BANK);
    else if (step === STEP.FORM) setStep(accountType === 'C' ? STEP.TYPE : STEP.INSTITUTION);
  };

  const pickType = (type) => {
    setAccountType(type);
    if (type === 'B') setStep(STEP.CONNECTION);
    else if (type === 'C') setStep(STEP.FORM);
    else setStep(STEP.CARD);
  };

  const pickBank = (bank) => {
    setSelectedBank(bank);
    setStep(STEP.INSTITUTION);
  };

  const handleCreate = async (values) => {
    setSubmitting(true);
    setFormError(null);
    try {
      await createAccount(values);
      toast.success(ui('financeAccountsNewCreateSuccess'));
      onCreated?.();
      onClose?.();
    } catch (err) {
      if (err.status === 409) {
        setFormError(ui('financeAccountsNewNameExists'));
      } else {
        toast.error(err.message || ui('financeAccountsNewCreateError'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const titles = {
    [STEP.TYPE]: ui('financeAccountsNewTitle'),
    [STEP.CONNECTION]: ui('financeAccountsNewConnectionTitle'),
    [STEP.BANK]: ui('financeAccountsNewBankTitle'),
    [STEP.INSTITUTION]: ui('financeAccountsNewBankTitle'),
    [STEP.FORM]: accountType === 'C'
      ? ui('financeAccountsNewFormCashTitle')
      : ui('financeAccountsNewFormBankTitle'),
    [STEP.CARD]: ui('financeAccountsNewCardSoonTitle'),
  };

  const showBadge = step === STEP.FORM && accountType === 'B';
  const contentWidth = step === STEP.TYPE
    ? 'max-w-[1016px]'
    : step === STEP.CONNECTION
      ? 'max-w-2xl'
      : 'max-w-lg';

  return (
    <Dialog open={open} onOpenChange={(value) => { if (!value) onClose?.(); }}>
      <DialogContent
        className={cn('bg-white', contentWidth)}
        data-testid="new-account-wizard"
      >
        <DialogHeader>
          <div className="flex items-center gap-2">
            {step !== STEP.TYPE ? (
              <button
                type="button"
                onClick={goBack}
                aria-label={ui('financeAccountsNewBack')}
                data-testid="new-account-back"
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#D1D4DB] text-[#121217] hover:bg-[#F5F7F9]"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            ) : null}
            <DialogTitle className="text-xl leading-7">{titles[step]}</DialogTitle>
            {showBadge ? (
              <span className="rounded-full bg-[#F5F7F9] px-2 py-0.5 text-xs font-normal text-[#6C6C89]">
                {ui('financeAccountsNewOfflineBadge')}
              </span>
            ) : null}
          </div>
          {step === STEP.TYPE ? (
            <DialogDescription className="text-xs leading-4 text-[#555B6D]">
              {ui('financeAccountsNewSubtitle')}
            </DialogDescription>
          ) : null}
        </DialogHeader>

        {step === STEP.TYPE ? (
          <TypePicker ui={ui} onPick={pickType} />
        ) : null}

        {step === STEP.CONNECTION ? (
          <div
            className="grid grid-cols-1 gap-3 py-2 sm:grid-cols-2"
            data-testid="account-connection-options"
          >
            <ConnectionCard
              icon={Link2}
              title={ui('financeAccountsNewConnectionOnline')}
              description={ui('financeAccountsNewConnectionOnlineDesc')}
              badge={ui('financeAccountsNewConnectionSoonBadge')}
              disabled
              testid="account-connection-online"
            />
            <ConnectionCard
              icon={PencilLine}
              title={ui('financeAccountsNewConnectionOffline')}
              description={ui('financeAccountsNewConnectionOfflineDesc')}
              onClick={() => setStep(STEP.BANK)}
              testid="account-connection-offline"
            />
          </div>
        ) : null}

        {step === STEP.BANK ? (
          <BankPicker ui={ui} query={bankQuery} onQueryChange={setBankQuery} onPick={pickBank} />
        ) : null}

        {step === STEP.INSTITUTION ? (
          <InstitutionList ui={ui} bank={selectedBank} onPick={() => setStep(STEP.FORM)} />
        ) : null}

        {step === STEP.FORM ? (
          <AccountFormStep
            key={accountType}
            mode={accountType === 'C' ? 'cash' : 'bank'}
            bankName={selectedBank?.name}
            currencies={currencies}
            defaultCurrencyId={defaultCurrencyId}
            submitting={submitting}
            error={formError}
            onSubmit={handleCreate}
          />
        ) : null}

        {step === STEP.CARD ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center" data-testid="new-account-card-soon">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#F5F7F9] text-[#828FA3]">
              <CreditCard className="h-6 w-6" />
            </span>
            <p className="text-sm text-[#6C6C89]">{ui('financeAccountsNewCardSoonDesc')}</p>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

const TYPE_CARDS = [
  { type: 'B', icon: Landmark, image: '/illustrations/account-type-bank.png', titleKey: 'financeAccountsNewTypeBank', descKey: 'financeAccountsNewTypeBankDesc' },
  { type: 'C', icon: Wallet, image: '/illustrations/account-type-cash.png', titleKey: 'financeAccountsNewTypeCash', descKey: 'financeAccountsNewTypeCashDesc' },
  { type: 'T', icon: CreditCard, image: '/illustrations/account-type-card.png', titleKey: 'financeAccountsNewTypeCard', descKey: 'financeAccountsNewTypeCardDesc' },
];

function TypePicker({ ui, onPick }) {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
      {TYPE_CARDS.map(({ type, icon: Icon, image, titleKey, descKey }) => (
        <button
          key={type}
          type="button"
          onClick={() => onPick(type)}
          data-testid={`new-account-type-${type}`}
          className="flex flex-col rounded-xl border border-[#E8EAEF] bg-white p-1 text-left shadow-[0_1px_2px_rgba(18,18,23,0.05)] transition-colors hover:bg-[#F5F7F9]"
        >
          <img
            src={image}
            alt=""
            aria-hidden="true"
            className="h-[180px] w-full rounded-lg object-cover"
          />
          <div className="flex flex-col gap-1 p-3">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#D1D4DB] bg-white text-[#828FA3] shadow-[0_1px_3px_rgba(18,18,23,0.1),0_1px_2px_rgba(18,18,23,0.06)]">
                <Icon className="h-5 w-5" />
              </span>
              <span className="text-base font-medium leading-6 text-[#121217]">{ui(titleKey)}</span>
            </div>
            <span className="text-sm font-normal leading-5 text-[#555B6D]">{ui(descKey)}</span>
          </div>
        </button>
      ))}
    </div>
  );
}

function BankPicker({ ui, query, onQueryChange, onPick }) {
  const banks = searchBanks(query);
  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#828FA3]" />
        <Input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder={ui('financeAccountsNewBankSearchPlaceholder')}
          className="pl-9"
          data-testid="new-account-bank-search"
        />
      </div>
      <p className="text-sm font-medium text-[#121217]">{ui('financeAccountsNewBankPopular')}</p>
      <div className="grid grid-cols-3 gap-2">
        {banks.map((bank) => (
          <button
            key={bank.id}
            type="button"
            onClick={() => onPick(bank)}
            data-testid={`new-account-bank-${bank.id}`}
            className="flex flex-col items-center gap-2 rounded-xl border border-[#E8EAEF] p-3 text-center transition-colors hover:border-[#121217]"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F5F7F9] text-[#828FA3]">
              <Landmark className="h-4 w-4" />
            </span>
            <span className="text-xs font-medium text-[#121217]">{bank.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function InstitutionList({ ui, bank, onPick }) {
  const institutions = institutionsFor(bank);
  return (
    <div className="flex flex-col gap-1">
      <p className="text-sm font-medium text-[#121217]">{ui('financeAccountsNewInstitutions')}</p>
      {institutions.map((inst) => (
        <button
          key={inst.id}
          type="button"
          onClick={onPick}
          data-testid={`new-account-institution-${inst.id}`}
          className="flex items-center justify-between rounded-lg px-3 py-2 text-left hover:bg-[#F5F7F9]"
        >
          <span className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#E8EAEF] text-[#828FA3]">
              <Landmark className="h-4 w-4" />
            </span>
            <span className="text-sm text-[#121217]">{inst.name}</span>
          </span>
          <ChevronRight className="h-4 w-4 text-[#828FA3]" />
        </button>
      ))}
      <button
        type="button"
        onClick={onPick}
        data-testid="new-account-institution-add"
        className="mt-1 flex items-center justify-between rounded-lg px-3 py-2 text-left hover:bg-[#F5F7F9]"
      >
        <span className="flex items-center gap-2 text-sm text-[#121217]">
          <Plus className="h-4 w-4 text-[#828FA3]" />
          {`${ui('financeAccountsNewInstitutionAddPrefix')} ${bank?.name ?? ''}`.trim()}
        </span>
        <span className="rounded-full bg-[#F5F7F9] px-2 py-0.5 text-xs font-normal text-[#6C6C89]">
          {ui('financeAccountsNewOfflineBadge')}
        </span>
      </button>
    </div>
  );
}

function ConnectionCard({ icon: Icon, title, description, badge, disabled, onClick, testid }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      data-testid={testid}
      className={cn(
        'flex flex-col gap-2 rounded-xl border border-[#E8EAEF] bg-white p-4 text-left shadow-[0_1px_2px_rgba(18,18,23,0.05)] transition-colors',
        disabled ? 'cursor-not-allowed opacity-70' : 'hover:bg-[#F5F7F9]',
      )}
    >
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#D1D4DB] bg-white text-[#828FA3] shadow-[0_1px_3px_rgba(18,18,23,0.1),0_1px_2px_rgba(18,18,23,0.06)]">
          <Icon className="h-5 w-5" />
        </span>
        <span className="text-base font-medium leading-6 text-[#121217]">{title}</span>
        {badge ? (
          <span className="rounded-full bg-[#F5F7F9] px-2 py-0.5 text-xs font-normal text-[#6C6C89]">
            {badge}
          </span>
        ) : null}
      </div>
      <span className="text-sm font-normal leading-5 text-[#555B6D]">{description}</span>
    </button>
  );
}

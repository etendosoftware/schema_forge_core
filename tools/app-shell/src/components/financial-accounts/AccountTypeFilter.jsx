import { ChevronDown, Check, Landmark, Wallet, CreditCard, Building2 } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useUI } from '@/i18n';
import { cn } from '@/lib/utils';
import { ACCOUNT_TYPE } from './tokens';

const ALL = 'ALL';

function useTypeOptions() {
  const ui = useUI();
  return [
    { value: ALL, label: ui('financeAccountsFilterAll'), Icon: Building2 },
    { value: ACCOUNT_TYPE.BANK, label: ui('financeAccountsTypeBank'), Icon: Landmark },
    { value: ACCOUNT_TYPE.CASH, label: ui('financeAccountsTypeCash'), Icon: Wallet },
    { value: ACCOUNT_TYPE.CARD, label: ui('financeAccountsTypeCard'), Icon: CreditCard },
  ];
}

export function AccountTypeFilter({ value, onChange }) {
  const ui = useUI();
  const options = useTypeOptions();
  const current = value ?? ALL;
  const active = options.find((opt) => opt.value === current) ?? options[0];

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          data-testid="account-type-filter-trigger"
          className="inline-flex h-10 w-[181px] items-center justify-between gap-1 rounded-lg border border-[#D1D4DB] bg-white px-3 text-sm font-medium leading-6 text-[#121217] shadow-[0_1px_2px_rgba(18,18,23,0.05)] hover:bg-[#F5F7F9]"
        >
          <span className="truncate text-left">{active.label}</span>
          <ChevronDown className="h-5 w-5 shrink-0 text-[#828FA3]" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-1" align="start">
        <div role="listbox" aria-label={ui('financeAccountsFilterAll')}>
          {options.map((opt) => {
            const selected = opt.value === current;
            return (
              <button
                key={opt.value}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => onChange?.(opt.value === ALL ? null : opt.value)}
                className={cn(
                  'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm',
                  'hover:bg-[#f5f7f9]',
                  selected ? 'font-semibold text-[#121217]' : 'text-[#3f3f50]',
                )}
                data-testid={`account-type-filter-option-${opt.value.toLowerCase()}`}
              >
                <opt.Icon className="h-4 w-4 text-[#6c6c89]" />
                <span className="flex-1 text-left">{opt.label}</span>
                {selected ? <Check className="h-4 w-4 text-[#121217]" /> : null}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

AccountTypeFilter.ALL = ALL;

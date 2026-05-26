import { ChevronDown, Calendar, Check } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useUI } from '@/i18n';
import { cn } from '@/lib/utils';

const DATE_RANGE_OPTIONS = [
  { value: 'last7d',     labelKey: 'financeAccountMovementsFilterLast7d' },
  { value: 'last30d',    labelKey: 'financeAccountMovementsFilterLast30d' },
  { value: 'last90d',    labelKey: 'financeAccountMovementsFilterLast90d' },
  { value: 'thisMonth',  labelKey: 'financeAccountMovementsFilterThisMonth' },
  { value: 'lastMonth',  labelKey: 'financeAccountMovementsFilterLastMonth' },
];

/**
 * Filter dropdown for movement date range.
 *
 * @param {{ value: string, onChange: (v: string) => void }} props
 */
export function DateRangeFilter({ value, onChange }) {
  const ui = useUI();

  const options = DATE_RANGE_OPTIONS.map((o) => ({ ...o, label: ui(o.labelKey) }));
  const active = options.find((o) => o.value === value) ?? options[1]; // default last30d

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex h-10 items-center justify-between gap-1 rounded-lg border border-[#D1D4DB] bg-white px-3 text-sm font-medium leading-6 text-[#121217] shadow-[0_1px_2px_rgba(18,18,23,0.05)] hover:bg-[#F5F7F9]"
        >
          <Calendar className="h-4 w-4 shrink-0 text-[#828FA3]" />
          <span className="mx-1 truncate text-left">{active.label}</span>
          <ChevronDown className="h-5 w-5 shrink-0 text-[#828FA3]" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-1" align="start">
        <div role="listbox">
          {options.map((opt) => {
            const selected = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => onChange?.(opt.value)}
                className={cn(
                  'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm',
                  'hover:bg-[#f5f7f9]',
                  selected ? 'font-semibold text-[#121217]' : 'text-[#3f3f50]',
                )}
              >
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

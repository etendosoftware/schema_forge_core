import { ChevronDown, Check } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useUI } from '@/i18n';
import { cn } from '@/lib/utils';
import { MOVEMENT_STATUS_TONE } from '@/components/financial-accounts/tokens';
import { MOVEMENT_STATUS_CONFIG, ALL_STATUSES } from '../movementStatusConfig';

/**
 * Filter dropdown for movement payment status.
 *
 * @param {{ value: string|null, onChange: (v: string|null) => void }} props
 */
export function StatusFilter({ value, onChange }) {
  const ui = useUI();

  const options = [
    { value: null, label: ui('financeAccountMovementsFilterAllStatuses'), family: null },
    ...ALL_STATUSES.map((key) => ({
      value: key,
      label: ui(MOVEMENT_STATUS_CONFIG[key].labelKey),
      family: MOVEMENT_STATUS_CONFIG[key].family,
    })),
  ];

  const active = options.find((o) => o.value === value) ?? options[0];

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex h-10 items-center justify-between gap-1 rounded-lg border border-[#D1D4DB] bg-white px-3 text-sm font-medium leading-6 text-[#121217] shadow-[0_1px_2px_rgba(18,18,23,0.05)] hover:bg-[#F5F7F9]"
        >
          <span className="truncate text-left">{active.label}</span>
          <ChevronDown className="h-5 w-5 shrink-0 text-[#828FA3]" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-1" align="start">
        <div role="listbox">
          {options.map((opt) => {
            const selected = opt.value === value || (opt.value === null && value === null);
            const tone = opt.family ? MOVEMENT_STATUS_TONE[opt.family] : null;
            return (
              <button
                key={opt.value ?? '__all__'}
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
                {tone ? (
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: tone.text }}
                  />
                ) : (
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#D1D4DB]" />
                )}
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

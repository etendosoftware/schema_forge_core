import { useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useUI } from '@/i18n';
import { DistinctValuesList } from '@/components/contract-ui/DistinctValuesList';

const TYPE_CODES = ['BPD', 'BPW'];

const LABEL_KEY_BY_CODE = {
  BPD: 'financeAccountMovementsTypeBPD',
  BPW: 'financeAccountMovementsTypeBPW',
};

/**
 * Filter dropdown for movement trxType (BPD = incoming, BPW = outgoing).
 * Uses the same search + list UX as the contract-ui list grids.
 *
 * @param {{ value: string|null, onChange: (v: string|null) => void }} props
 */
export function TypeFilter({ value, onChange }) {
  const ui = useUI();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const labelMap = useMemo(() => {
    const map = {};
    for (const code of TYPE_CODES) {
      map[code] = ui(LABEL_KEY_BY_CODE[code]);
    }
    return map;
  }, [ui]);

  const labelFor = (code) => labelMap[code] ?? code;

  const filteredCodes = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return TYPE_CODES;
    return TYPE_CODES.filter(
      (code) =>
        labelFor(code).toLowerCase().includes(q) ||
        code.toLowerCase().includes(q),
    );
  }, [search, labelMap]);

  const distinct = {
    search,
    setSearch,
    loading: false,
    loadingMore: false,
    hasMore: false,
    loadMore: () => {},
    values: filteredCodes,
  };

  const triggerLabel = value
    ? labelFor(value)
    : ui('financeAccountMovementsFilterTypeAll');

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex h-10 items-center justify-between gap-1 rounded-lg border border-[#D1D4DB] bg-white px-3 text-sm font-medium leading-6 text-[#121217] shadow-[0_1px_2px_rgba(18,18,23,0.05)] hover:bg-[#F5F7F9]"
        >
          <span className="truncate text-left">{triggerLabel}</span>
          <ChevronDown className="h-5 w-5 shrink-0 text-[#828FA3]" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-0" align="start">
        <DistinctValuesList
          activeCode={value}
          allLabel={ui('financeAccountMovementsFilterTypeAll')}
          codes={filteredCodes}
          labelFor={labelFor}
          distinct={distinct}
          onSelect={(code) => {
            onChange?.(code);
            setOpen(false);
          }}
          searchPlaceholder={ui('financeAccountMovementsFilterTypeSearchPlaceholder')}
        />
      </PopoverContent>
    </Popover>
  );
}

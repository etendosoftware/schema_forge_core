import { useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DistinctValuesList } from '@/components/contract-ui/DistinctValuesList';

/**
 * Reusable Popover that wraps a {@link DistinctValuesList} for an
 * in-memory fixed list of codes (no backend pagination).
 *
 * Used by StatusFilter, TypeFilter, and any other filter that needs the
 * "search + scrollable list of codes" UX without hitting `useDistinctValues`.
 *
 * @param {{
 *   value: string|null;
 *   onChange: (v: string|null) => void;
 *   codes: string[];
 *   labelFor: (code: string) => string;
 *   allLabel: string;
 *   searchPlaceholder: string;
 *   popoverWidth?: string;
 * }} props
 */
export function DistinctValuesFilter({
  value,
  onChange,
  codes,
  labelFor,
  allLabel,
  searchPlaceholder,
  popoverWidth = 'w-64',
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filteredCodes = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return codes;
    return codes.filter(
      (code) =>
        labelFor(code).toLowerCase().includes(q) ||
        code.toLowerCase().includes(q),
    );
  }, [search, codes, labelFor]);

  const distinct = {
    search,
    setSearch,
    loading: false,
    loadingMore: false,
    hasMore: false,
    loadMore: () => {},
    values: filteredCodes,
  };

  const triggerLabel = value ? labelFor(value) : allLabel;

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
      <PopoverContent className={`${popoverWidth} p-0`} align="start">
        <DistinctValuesList
          activeCode={value}
          allLabel={allLabel}
          codes={filteredCodes}
          labelFor={labelFor}
          distinct={distinct}
          onSelect={(code) => {
            onChange?.(code);
            setOpen(false);
          }}
          searchPlaceholder={searchPlaceholder}
        />
      </PopoverContent>
    </Popover>
  );
}

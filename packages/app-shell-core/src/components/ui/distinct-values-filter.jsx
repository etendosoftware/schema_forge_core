import { useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from './popover.jsx';
import { DistinctValuesList } from '../contract-ui/DistinctValuesList.jsx';

/**
 * Reusable Popover that wraps a {@link DistinctValuesList} for an
 * in-memory fixed list of codes (no backend pagination).
 *
 * Used by StatusFilter, TypeFilter, and any other filter that needs the
 * "search + scrollable list of codes" UX without hitting `useDistinctValues`.
 *
 * Multi-select (ETP-5591, opt-in): pass `multiple`. `value` is then an array of
 * codes (empty / null = "all"), every row toggles its code, the "all" row
 * reports `[]`, the popover stays open while picking, and rows show a checkbox.
 * The trigger reads `allLabel` (nothing picked), the one picked label, or
 * `multipleLabel(count)` (two or more; falls back to the joined labels).
 *
 * @param {{
 *   value: string|null|string[];
 *   onChange: (v: string|null|string[]) => void;
 *   codes: string[];
 *   labelFor: (code: string) => string;
 *   allLabel: string;
 *   searchPlaceholder: string;
 *   popoverWidth?: string;
 *   multiple?: boolean;
 *   multipleLabel?: (count: number) => string;
 *   heading?: string|null;
 *   searchable?: boolean;
 *   renderLabel?: (code: string) => import('react').ReactNode;
 *   triggerTestId?: string;
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
  multiple = false,
  multipleLabel = null,
  heading = null,
  searchable = true,
  renderLabel = null,
  triggerTestId,
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

  const selectedCodes = multiple ? (Array.isArray(value) ? value : []) : null;

  let triggerLabel;
  if (!multiple) {
    triggerLabel = value ? labelFor(value) : allLabel;
  } else if (selectedCodes.length === 0) {
    triggerLabel = allLabel;
  } else if (selectedCodes.length === 1) {
    triggerLabel = labelFor(selectedCodes[0]);
  } else {
    triggerLabel = multipleLabel
      ? multipleLabel(selectedCodes.length)
      : selectedCodes.map(labelFor).join(', ');
  }

  const handleSelect = (code) => {
    if (!multiple) {
      onChange?.(code);
      setOpen(false);
      return;
    }
    if (code === null) {
      onChange?.([]);
      return;
    }
    onChange?.(selectedCodes.includes(code)
      ? selectedCodes.filter((c) => c !== code)
      : [...selectedCodes, code]);
  };

  return (
    <Popover open={open} onOpenChange={setOpen} data-testid="Popover__cd3aa9">
      <PopoverTrigger asChild data-testid="PopoverTrigger__cd3aa9">
        <button
          type="button"
          data-testid={triggerTestId}
          className="inline-flex h-9 items-center justify-between gap-1.5 rounded-lg border border-border bg-white px-3 text-sm font-normal leading-6 text-muted-foreground transition-colors hover:bg-[#F5F7F9]"
        >
          <span className="truncate text-left">{triggerLabel}</span>
          <ChevronDown
            className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
            data-testid="ChevronDown__cd3aa9" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className={`${popoverWidth} p-0`}
        align="start"
        data-testid="PopoverContent__cd3aa9">
        <DistinctValuesList
          activeCode={multiple ? undefined : value}
          activeCodes={selectedCodes}
          allLabel={allLabel}
          codes={filteredCodes}
          labelFor={labelFor}
          distinct={distinct}
          onSelect={handleSelect}
          searchPlaceholder={searchPlaceholder}
          heading={heading}
          searchable={searchable}
          renderLabel={renderLabel}
          indicator={multiple ? 'checkbox' : 'check'}
          data-testid="DistinctValuesList__cd3aa9" />
      </PopoverContent>
    </Popover>
  );
}

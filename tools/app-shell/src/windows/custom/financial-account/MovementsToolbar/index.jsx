import { useMemo, useState } from 'react';
import { ArrowLeft, Filter } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useUI } from '@/i18n';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { AdvancedFilterBuilder } from '@/components/contract-ui/AdvancedFilterBuilder.jsx';
import { DateRangeFilter } from './DateRangeFilter';
import { TypeFilter } from './TypeFilter';
import { buildMovementFilterColumns } from '../movementAdvancedFilter';

/**
 * Toolbar for the movements tab.
 *
 * Status and amount dropdowns were replaced by the generic "Filtro por
 * condicionales" (AdvancedFilterBuilder), which filters client-side over the
 * movement columns. Date range and type stay (date also drives the KPI window).
 *
 * @param {{
 *   filters: { dateRange: object, type: string|null, search: string },
 *   onFiltersChange: (key: string) => (value: unknown) => void,
 *   advancedFilter: object|null,
 *   onAdvancedFilterChange: (next: object|null) => void,
 *   onNewMovement?: () => void,
 * }} props
 */
export function MovementsToolbar({
  filters,
  onFiltersChange,
  advancedFilter,
  onAdvancedFilterChange,
  onNewMovement,
  rows = [],
}) {
  const ui = useUI();
  const navigate = useNavigate();
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const columns = useMemo(() => buildMovementFilterColumns(ui), [ui]);
  const activeConditions = advancedFilter?.conditions?.length ?? 0;

  return (
    <div className="flex h-auto min-h-[52px] flex-wrap items-center gap-2 px-2 py-2">
      {/* Back */}
      <button
        type="button"
        aria-label={ui('financeAccountDetailBack')}
        data-testid="movements-toolbar-back"
        onClick={() => navigate(-1)}
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#D1D4DB] bg-white text-[#6c6c89] shadow-[0_1px_2px_rgba(18,18,23,0.05)] hover:bg-[#F5F7F9] hover:text-[#121217]"
      >
        <ArrowLeft className="h-4 w-4" />
      </button>

      {/* Remaining quick filters */}
      <DateRangeFilter value={filters.dateRange} onChange={onFiltersChange('dateRange')} />
      <TypeFilter value={filters.type} onChange={onFiltersChange('type')} />

      {/* Advanced "by conditions" filter — right after the Type filter */}
      <Popover open={advancedOpen} onOpenChange={setAdvancedOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            data-testid="movements-advanced-filter"
            title={ui('advancedFilterTitle')}
            className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#D1D4DB] bg-white text-[#6c6c89] shadow-[0_1px_2px_rgba(18,18,23,0.05)] hover:bg-[#F5F7F9] hover:text-[#121217]"
          >
            <Filter className="h-4 w-4" />
            {activeConditions > 0 ? (
              <span className="absolute -right-1.5 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#121217] px-1 text-[10px] font-semibold leading-none text-white">
                {activeConditions}
              </span>
            ) : null}
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-4">
          <AdvancedFilterBuilder
            columns={columns}
            rows={rows}
            value={advancedFilter}
            onApply={(next) => onAdvancedFilterChange?.(next)}
            onClear={() => onAdvancedFilterChange?.(null)}
            onClose={() => setAdvancedOpen(false)}
          />
        </PopoverContent>
      </Popover>

      {/* Search */}
      <div className="flex-1" />
      <div className="relative flex items-center">
        <input
          type="search"
          placeholder={ui('financeAccountMovementsSearch')}
          value={filters.search}
          onChange={(e) => onFiltersChange('search')(e.target.value)}
          data-testid="movements-search-input"
          className="h-10 w-48 rounded-lg border border-[#D1D4DB] bg-white px-3 text-sm text-[#121217] placeholder:text-[#8a8aa3] shadow-[0_1px_2px_rgba(18,18,23,0.05)] focus:outline-none focus:ring-2 focus:ring-[#121217] focus:ring-offset-1"
        />
      </div>

      {/* New movement */}
      <button
        type="button"
        data-testid="new-movement-button"
        onClick={onNewMovement}
        className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#121217] px-3 text-sm font-medium text-white transition-colors hover:bg-[#FFD500] hover:text-[#121217]"
      >
        {ui('financeAccountMovementsNew')}
      </button>
    </div>
  );
}

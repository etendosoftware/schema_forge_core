import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useUI } from '@/i18n';
import { StatusFilter } from './StatusFilter';
import { DateRangeFilter } from './DateRangeFilter';
import { TypeFilter } from './TypeFilter';
import { AmountFilter } from './AmountFilter';

/**
 * Toolbar for the movements tab.
 * Contains filter dropdowns, search input, export and new movement actions.
 *
 * @param {{
 *   filters: { status: string|null, dateRange: string, type: string|null, amount: string|null, search: string },
 *   onFiltersChange: (key: string) => (value: unknown) => void,
 *   onNewMovement?: () => void,
 * }} props
 */
export function MovementsToolbar({ filters, onFiltersChange, onNewMovement }) {
  const ui = useUI();
  const navigate = useNavigate();

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

      {/* Filters */}
      <StatusFilter value={filters.status} onChange={onFiltersChange('status')} />
      <DateRangeFilter value={filters.dateRange} onChange={onFiltersChange('dateRange')} />
      <TypeFilter value={filters.type} onChange={onFiltersChange('type')} />
      <AmountFilter value={filters.amount} onChange={onFiltersChange('amount')} />

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

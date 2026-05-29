import { ArrowLeft, Upload } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useUI } from '@/i18n';
import { DateRangePopover } from '@/components/ui/date-range-popover';
import { StatementStatusFilter } from './StatementStatusFilter';

/**
 * Toolbar for the imported statements tab.
 *
 * @param {{
 *   search: string;
 *   onSearchChange: (v: string) => void;
 *   dateRange: null | { presetId: string } | { from: Date, to: Date };
 *   onDateRangeChange: (v: null | { presetId: string } | { from: Date, to: Date }) => void;
 *   status: string|null;
 *   onStatusChange: (v: string|null) => void;
 *   onImportClick: () => void;
 * }} props
 */
export function StatementsToolbar({
  search,
  onSearchChange,
  dateRange,
  onDateRangeChange,
  status,
  onStatusChange,
  onImportClick,
}) {
  const ui = useUI();
  const navigate = useNavigate();

  return (
    <div className="flex h-auto min-h-[52px] flex-wrap items-center gap-2 px-4 py-2">
      {/* Back */}
      <button
        type="button"
        aria-label={ui('financeAccountDetailBack')}
        data-testid="statements-toolbar-back"
        onClick={() => navigate(-1)}
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#D1D4DB] bg-white text-[#6c6c89] shadow-[0_1px_2px_rgba(18,18,23,0.05)] hover:bg-[#F5F7F9] hover:text-[#121217]"
      >
        <ArrowLeft className="h-4 w-4" />
      </button>

      {/* Date range filter */}
      <DateRangePopover
        value={dateRange}
        onChange={onDateRangeChange}
        placeholder={ui('dateRangeAnyTime')}
      />

      {/* Status filter */}
      <StatementStatusFilter value={status} onChange={onStatusChange} />

      {/* Spacer */}
      <div className="flex-1" />

      {/* Search */}
      <div className="relative flex items-center">
        <input
          type="search"
          placeholder={ui('financeAccountStatementsSearch')}
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          data-testid="statements-search-input"
          className="h-10 w-48 rounded-lg border border-[#D1D4DB] bg-white px-3 text-sm text-[#121217] placeholder:text-[#8a8aa3] shadow-[0_1px_2px_rgba(18,18,23,0.05)] focus:outline-none focus:ring-2 focus:ring-[#121217] focus:ring-offset-1"
        />
      </div>

      {/* Import */}
      <button
        type="button"
        data-testid="statements-import-button"
        onClick={onImportClick}
        className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#121217] px-3 text-sm font-medium text-white transition-colors hover:bg-[#FFD500] hover:text-[#121217]"
      >
        <Upload className="h-4 w-4" />
        {ui('financeAccountStatementsImport')}
      </button>
    </div>
  );
}

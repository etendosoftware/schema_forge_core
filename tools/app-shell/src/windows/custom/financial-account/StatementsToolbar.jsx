import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ChevronDown, Filter, Pencil, Upload } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useUI } from '@/i18n';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { AdvancedFilterBuilder } from '@/components/contract-ui/AdvancedFilterBuilder.jsx';
import { DateRangePopover } from '@/components/ui/date-range-popover';
import { StatementStatusFilter } from './StatementStatusFilter';
import { buildStatementFilterColumns } from './statementAdvancedFilter';

/**
 * Split-button: a primary "Importar extracto" action plus a ▾ trigger that
 * opens a small menu with "Crear manualmente". Mirrors the design's
 * SplitImport. Closes on outside click / Escape.
 */
function ImportSplitButton({ ui, onImportClick, onManualClick }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative flex items-stretch">
      <button
        type="button"
        data-testid="statements-import-button"
        onClick={onImportClick}
        className="inline-flex h-10 items-center gap-2 rounded-l-lg bg-[#121217] px-3 text-sm font-medium text-white transition-colors hover:bg-[#FFD500] hover:text-[#121217]"
      >
        <Upload className="h-4 w-4" />
        {ui('financeAccountStatementsImport')}
      </button>
      <button
        type="button"
        aria-label={ui('financeAccountStatementsManualMore')}
        aria-haspopup="menu"
        aria-expanded={open}
        data-testid="statements-import-split"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex h-10 w-9 items-center justify-center rounded-r-lg border-l border-white/20 bg-[#121217] text-white transition-colors hover:bg-[#FFD500] hover:text-[#121217]"
      >
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-11 z-50 w-72 overflow-hidden rounded-lg border border-[#E8EAEF] bg-white shadow-lg"
        >
          <button
            type="button"
            role="menuitem"
            data-testid="statements-manual-create"
            onClick={() => { setOpen(false); onManualClick(); }}
            className="flex w-full items-start gap-3 px-3 py-2.5 text-left hover:bg-[#F5F7F9]"
          >
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#F0F2F5] text-[#121217]">
              <Pencil className="h-4 w-4" />
            </span>
            <span className="flex flex-col">
              <span className="text-sm font-semibold text-[#121217]">
                {ui('financeAccountStatementsManualMenuItem')}
              </span>
              <span className="text-xs text-[#6C6C89]">
                {ui('financeAccountStatementsManualMenuItemDesc')}
              </span>
            </span>
          </button>
        </div>
      ) : null}
    </div>
  );
}

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
 *   advancedFilter?: object|null;
 *   onAdvancedFilterChange?: (next: object|null) => void;
 *   rows?: Array<object>;
 *   onImportClick: () => void;
 *   onManualClick: () => void;
 * }} props
 */
export function StatementsToolbar({
  search,
  onSearchChange,
  dateRange,
  onDateRangeChange,
  status,
  onStatusChange,
  advancedFilter,
  onAdvancedFilterChange,
  rows = [],
  onImportClick,
  onManualClick,
}) {
  const ui = useUI();
  const navigate = useNavigate();
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const columns = useMemo(() => buildStatementFilterColumns(ui), [ui]);
  const activeConditions = advancedFilter?.conditions?.length ?? 0;

  return (
    <div className="flex h-auto min-h-[52px] flex-wrap items-center gap-2 px-4 py-2">
      {/* Back */}
      <button
        type="button"
        aria-label={ui('financeAccountDetailBack')}
        data-testid="statements-toolbar-back"
        onClick={() => navigate(-1)}
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-white text-muted-foreground transition-colors hover:bg-[#F5F7F9] hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
      </button>

      {/* Status filter — first, mirroring the standard list toolbar (e.g. Sales Order). */}
      <StatementStatusFilter value={status} onChange={onStatusChange} />

      {/* Date range filter */}
      <DateRangePopover
        value={dateRange}
        onChange={onDateRangeChange}
        placeholder={ui('dateRangeAnyTime')}
      />

      {/* Advanced "by conditions" filter */}
      {onAdvancedFilterChange ? (
        <Popover open={advancedOpen} onOpenChange={setAdvancedOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              data-testid="statements-advanced-filter"
              title={ui('advancedFilterTitle')}
              className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-white text-muted-foreground transition-colors hover:bg-[#F5F7F9] hover:text-foreground"
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
              onApply={(next) => onAdvancedFilterChange(next)}
              onClear={() => onAdvancedFilterChange(null)}
              onClose={() => setAdvancedOpen(false)}
            />
          </PopoverContent>
        </Popover>
      ) : null}

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

      {/* Import (split-button: import file ▾ create manually) */}
      <ImportSplitButton ui={ui} onImportClick={onImportClick} onManualClick={onManualClick} />
    </div>
  );
}

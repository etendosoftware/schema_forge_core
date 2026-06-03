import { forwardRef, useImperativeHandle, useRef, useState, useMemo } from 'react';
import { AccountSummaryStrip } from './AccountSummaryStrip';
import { MovementsToolbar } from './MovementsToolbar/index';
import { MovementsTable } from './MovementsTable';
import { NewMovementWizard } from './NewMovementWizard/index.jsx';
import { applyAdvancedFilter } from './movementAdvancedFilter';

// ---------------------------------------------------------------------------
// Date range helpers
// ---------------------------------------------------------------------------

function presetBounds(presetId) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const to = new Date(today);
  const from = new Date(today);
  if (presetId === 'today') {
    /* from = to = start of today */
  } else if (presetId === 'yesterday') {
    from.setDate(from.getDate() - 1);
    to.setDate(to.getDate() - 1);
  } else if (presetId === 'last7') {
    from.setDate(from.getDate() - 6);
  } else if (presetId === 'last30') {
    from.setDate(from.getDate() - 29);
  } else if (presetId === 'last12m') {
    from.setMonth(from.getMonth() - 12);
  } else {
    return null;
  }
  // Include the whole "to" day
  to.setHours(23, 59, 59, 999);
  return { from, to };
}

/**
 * Resolves a DateRangePopover value into concrete `{ from, to }` Date bounds
 * (or null = no constraint).
 *
 * @param {null | { presetId: string } | { from: Date, to: Date }} dateRange
 */
function getDateBounds(dateRange) {
  if (!dateRange) return { from: null, to: null };
  if ('presetId' in dateRange) {
    const bounds = presetBounds(dateRange.presetId);
    return bounds ?? { from: null, to: null };
  }
  if ('from' in dateRange && 'to' in dateRange) {
    const from = dateRange.from instanceof Date ? new Date(dateRange.from) : null;
    const to = dateRange.to instanceof Date ? new Date(dateRange.to) : null;
    if (from) from.setHours(0, 0, 0, 0);
    if (to) to.setHours(23, 59, 59, 999);
    return { from, to };
  }
  return { from: null, to: null };
}

// ---------------------------------------------------------------------------
// KPI window suffix (shown in parentheses next to Inflows / Outflows labels)
// ---------------------------------------------------------------------------

const PRESET_TO_SUFFIX = {
  today:     { key: 'financeAccountDetailKpiWindowToday',     params: null },
  yesterday: { key: 'financeAccountDetailKpiWindowYesterday', params: null },
  last7:     { key: 'financeAccountDetailKpiWindowDays',      params: { count: 7 } },
  last30:    { key: 'financeAccountDetailKpiWindowDays',      params: { count: 30 } },
  last12m:   { key: 'financeAccountDetailKpiWindowMonths',    params: { count: 12 } },
};

function kpiWindowSuffix(dateRange) {
  if (!dateRange) return null;
  if ('presetId' in dateRange) return PRESET_TO_SUFFIX[dateRange.presetId] ?? null;
  if ('from' in dateRange && 'to' in dateRange) {
    return { key: 'financeAccountDetailKpiWindowRange', params: null };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Main filter function — quick filters (date range, type, search). Status and
// amount moved to the advanced "by conditions" filter (applyAdvancedFilter).
// ---------------------------------------------------------------------------

function applyFilters(movements, filters) {
  const { from, to } = getDateBounds(filters.dateRange);
  const q = filters.search.trim().toLowerCase();

  return movements.filter((m) => {
    // Date range
    if (from || to) {
      const d = new Date(m.date);
      if (from && d < from) return false;
      if (to && d > to) return false;
    }

    // Type (BPD / BPW)
    if (filters.type && m.trxType !== filters.type) return false;

    // Full-text search on document, contact, description
    if (q) {
      const haystack = [m.documentNo, m.contact, m.description]
        .map((s) => (s ?? '').toLowerCase())
        .join(' ');
      if (!haystack.includes(q)) return false;
    }

    return true;
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Movements tab content: summary strip + toolbar + table.
 *
 * Exposes `getFilteredMovements()` via ref so the parent's Export button can
 * grab the currently-visible rows without owning the filter state.
 *
 * @param {{
 *   account: object|null,
 *   totals: { balance: number, inflows: number, outflows: number, currency: string },
 *   movements: Array<object>,
 *   loading: boolean
 * }} props
 */
export const MovementsTab = forwardRef(function MovementsTab(
  { account, totals, movements, enabledDimensions = [], headerDimensions = [], trxTypes = [], accountOrgId = null, paymentMethods = [], loading, onReload },
  ref,
) {
  const [filters, setFilters] = useState({
    dateRange: { presetId: 'last30' },
    type: null,
    search: '',
  });
  const [advancedFilter, setAdvancedFilter] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [newMovementOpen, setNewMovementOpen] = useState(false);

  const handleFilterChange = (key) => (val) => {
    setFilters((prev) => ({ ...prev, [key]: val }));
  };

  const handleSelectionChange = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filteredMovements = useMemo(
    () => applyAdvancedFilter(applyFilters(movements, filters), advancedFilter),
    [movements, filters, advancedFilter],
  );

  // Latest filtered list is also reachable via ref so the parent's Export
  // button can read it on click without subscribing to filter changes.
  const filteredRef = useRef(filteredMovements);
  filteredRef.current = filteredMovements;
  useImperativeHandle(ref, () => ({
    getFilteredMovements: () => filteredRef.current,
  }), []);

  // Recompute inflows/outflows from the date-filtered movements (ignores
  // status/type/amount/search filters so the KPIs only react to the date range,
  // matching how Classic's "30D" widget worked but tied to the active window).
  const dateScopedTotals = useMemo(() => {
    const { from, to } = getDateBounds(filters.dateRange);
    let inflows = 0;
    let outflows = 0;
    for (const m of movements) {
      if (from || to) {
        const d = new Date(m.date);
        if (from && d < from) continue;
        if (to && d > to) continue;
      }
      const amt = Number(m.amount) || 0;
      if (amt >= 0) inflows += amt;
      else outflows += amt;
    }
    return {
      balance: totals.balance,
      currency: totals.currency,
      inflows,
      outflows,
      windowSuffix: kpiWindowSuffix(filters.dateRange),
    };
  }, [movements, filters.dateRange, totals.balance, totals.currency]);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <MovementsToolbar
        filters={filters}
        onFiltersChange={handleFilterChange}
        advancedFilter={advancedFilter}
        onAdvancedFilterChange={setAdvancedFilter}
        onNewMovement={() => setNewMovementOpen(true)}
      />
      <AccountSummaryStrip account={account} totals={dateScopedTotals} loading={loading} />
      <div className="flex-1 overflow-y-auto [&>div]:overflow-visible">
        <MovementsTable
          movements={filteredMovements}
          loading={loading}
          enabledDimensions={enabledDimensions}
          selectedIds={selectedIds}
          onSelectionChange={handleSelectionChange}
        />
      </div>

      <NewMovementWizard
        open={newMovementOpen}
        accountId={account?.id}
        accountCurrency={account?.currencyIso
          ? { id: account?.currencyId, iso: account.currencyIso }
          : null}
        dimensions={headerDimensions}
        trxTypes={trxTypes}
        defaultOrgId={accountOrgId}
        paymentMethods={paymentMethods}
        onClose={() => setNewMovementOpen(false)}
        onSuccess={() => onReload?.()}
      />
    </div>
  );
});

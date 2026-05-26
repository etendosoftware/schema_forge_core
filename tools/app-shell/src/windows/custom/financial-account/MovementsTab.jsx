import { useState, useEffect, useMemo } from 'react';
import { AccountSummaryStrip } from './AccountSummaryStrip';
import { MovementsToolbar } from './MovementsToolbar/index';
import { MovementsTable } from './MovementsTable';

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
// Amount range helper
// ---------------------------------------------------------------------------

function matchesAmount(amount, filter) {
  if (!filter) return true;

  // Preset (only inflows / only outflows)
  if ('presetId' in filter) {
    if (filter.presetId === 'gt0') return amount > 0;
    if (filter.presetId === 'lt0') return amount < 0;
    return true;
  }

  // Manual range — signed comparison so min:0 means "only inflows (>= 0)"
  // and max:0 means "only outflows (<= 0)".
  return (
    (filter.min == null || amount >= filter.min)
    && (filter.max == null || amount <= filter.max)
  );
}

// ---------------------------------------------------------------------------
// Main filter function
// ---------------------------------------------------------------------------

function applyFilters(movements, filters) {
  const { from, to } = getDateBounds(filters.dateRange);
  const q = filters.search.trim().toLowerCase();

  return movements.filter((m) => {
    // Status
    if (filters.status && m.paymentStatus !== filters.status) return false;

    // Date range
    if (from || to) {
      const d = new Date(m.date);
      if (from && d < from) return false;
      if (to && d > to) return false;
    }

    // Type (BPD / BPW)
    if (filters.type && m.trxType !== filters.type) return false;

    // Amount
    if (!matchesAmount(m.amount, filters.amount)) return false;

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
 * @param {{
 *   account: object|null,
 *   totals: { balance: number, inflows: number, outflows: number, currency: string },
 *   movements: Array<object>,
 *   loading: boolean
 * }} props
 */
export function MovementsTab({ account, totals, movements, loading }) {
  const [filters, setFilters] = useState({
    status: null,
    dateRange: { presetId: 'last30' },
    type: null,
    amount: null,
    search: '',
  });
  const [selectedIds, setSelectedIds] = useState(new Set());

  // Clear selection when filters change
  useEffect(() => {
    setSelectedIds(new Set());
  }, [filters]);

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
    () => applyFilters(movements, filters),
    [movements, filters],
  );

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <MovementsToolbar filters={filters} onFiltersChange={handleFilterChange} />
      <AccountSummaryStrip account={account} totals={totals} loading={loading} />
      <div className="flex-1 overflow-y-auto [&>div]:overflow-visible">
        <MovementsTable
          movements={filteredMovements}
          loading={loading}
          selectedIds={selectedIds}
          onSelectionChange={handleSelectionChange}
        />
      </div>
    </div>
  );
}

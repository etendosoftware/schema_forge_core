import { useState, useEffect } from 'react';
import { AccountSummaryStrip } from './AccountSummaryStrip';
import { MovementsToolbar } from './MovementsToolbar/index';
import { MovementsTable } from './MovementsTable';

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
export function MovimientosTab({ account, totals, movements, loading }) {
  const [filters, setFilters] = useState({
    status: null,
    dateRange: 'last30d',
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
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <AccountSummaryStrip account={account} totals={totals} loading={loading} />
      <MovementsToolbar filters={filters} onFiltersChange={handleFilterChange} />
      <div className="flex-1 overflow-auto">
        <MovementsTable
          movements={movements}
          loading={loading}
          selectedIds={selectedIds}
          onSelectionChange={handleSelectionChange}
        />
      </div>
    </div>
  );
}

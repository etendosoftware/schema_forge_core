import React, { useState, useMemo } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, Inbox } from 'lucide-react';

/**
 * Map a status string to a Badge variant and optional className override.
 */
function getStatusBadgeProps(status) {
  const s = String(status ?? '').toLowerCase();
  if (s === 'draft' || s === 'dr') {
    return { variant: 'secondary', children: status };
  }
  if (s === 'completed' || s === 'complete' || s === 'booked' || s === 'co') {
    return { variant: 'default', className: 'bg-emerald-600 hover:bg-emerald-700 border-transparent text-white', children: status };
  }
  if (s === 'voided' || s === 'cancelled' || s === 'void' || s === 'vo') {
    return { variant: 'destructive', children: status };
  }
  if (s === 'in process' || s === 'ip') {
    return { variant: 'outline', className: 'border-amber-300 bg-amber-50 text-amber-700', children: status };
  }
  return { variant: 'outline', children: status };
}

/**
 * Loading skeleton that mimics a table layout.
 */
function TableSkeleton({ columns }) {
  return (
    <div className="space-y-2">
      {/* Header skeleton */}
      <div className="flex gap-3 px-2">
        {columns.map(col => (
          <Skeleton key={col.key} className="h-4 flex-1" />
        ))}
      </div>
      {/* Row skeletons */}
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex gap-3 px-2">
          {columns.map(col => (
            <Skeleton key={col.key} className="h-8 flex-1" style={{ opacity: 1 - i * 0.15 }} />
          ))}
        </div>
      ))}
    </div>
  );
}

/**
 * Empty state shown when the table has no data (or all rows are filtered out).
 */
function EmptyState({ hasFilter, totalCount }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
      <Inbox className="h-10 w-10 mb-3 opacity-40" />
      {hasFilter ? (
        <>
          <p className="text-sm font-medium">No matching records</p>
          <p className="text-xs mt-1">Try adjusting your filters to find what you are looking for.</p>
        </>
      ) : (
        <>
          <p className="text-sm font-medium">No records yet</p>
          <p className="text-xs mt-1">Create a new record to get started.</p>
        </>
      )}
    </div>
  );
}

/**
 * Generic data table driven by column/filter declarations.
 *
 * Props:
 *  - columns: Array<{ key, label, type }>  (type can be 'string' | 'amount' | 'status')
 *  - filters: string[] of column keys that are searchable
 *  - data: array of row objects
 *  - onRowSelect: (row) => void
 *  - selectedId: string | number
 *  - compact: boolean (reserved for narrower layout)
 *  - loading: boolean (shows skeleton when true)
 */
export function DataTable({ columns = [], filters = [], data = [], onRowSelect, selectedId, compact, loading }) {
  const [filterValues, setFilterValues] = useState({});

  const setFilter = (key, value) => {
    setFilterValues(prev => ({ ...prev, [key]: value }));
  };

  const hasActiveFilter = Object.values(filterValues).some(v => v && v.length > 0);

  const filteredData = useMemo(() => {
    return data.filter(row => {
      for (const key of filters) {
        const filterVal = filterValues[key];
        if (filterVal && !String(row[key] ?? '').toLowerCase().includes(filterVal.toLowerCase())) {
          return false;
        }
      }
      return true;
    });
  }, [data, filters, filterValues]);

  const renderCellValue = (row, col) => {
    if (col.type === 'status') {
      const badgeProps = getStatusBadgeProps(row[col.key]);
      return <Badge {...badgeProps} />;
    }
    if (col.type === 'boolean') {
      const val = row[col.key];
      if (val === true || val === 'Y') return <span className="text-emerald-600">Yes</span>;
      if (val === false || val === 'N') return <span className="text-slate-400">No</span>;
      return <span className="text-slate-300">&mdash;</span>;
    }
    if (col.type === 'amount') {
      return <span className="tabular-nums">{row[col.key]?.toLocaleString()}</span>;
    }
    return row[col.key];
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <TableSkeleton columns={columns.length > 0 ? columns : [{ key: '_1' }, { key: '_2' }, { key: '_3' }]} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        {filters.map(key => {
          const col = columns.find(c => c.key === key);
          const label = col?.label ?? key;
          return (
            <div key={key} className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={`Filter ${label}...`}
                value={filterValues[key] ?? ''}
                onChange={(e) => setFilter(key, e.target.value)}
                className="pl-8 max-w-xs focus:ring-2 focus:ring-primary focus:outline-none transition-colors duration-200"
                aria-label={`Filter by ${label}`}
              />
            </div>
          );
        })}
      </div>
      <div className="rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-b-2 border-primary/20 bg-muted/40">
              {columns.map(col => (
                <TableHead key={col.key} className="text-xs font-medium text-blue-800 uppercase tracking-wider">
                  {col.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length || 1} className="p-0">
                  <EmptyState hasFilter={hasActiveFilter} totalCount={data.length} />
                </TableCell>
              </TableRow>
            ) : (
              filteredData.map((row, idx) => (
                <TableRow
                  key={row.id ?? idx}
                  onClick={() => onRowSelect?.(row)}
                  className={[
                    'cursor-pointer transition-colors',
                    row.id === selectedId ? 'bg-primary/10 border-l-2 border-l-primary' : '',
                    idx % 2 !== 0 && row.id !== selectedId ? 'bg-muted/30' : '',
                    'hover:bg-primary/5',
                  ].filter(Boolean).join(' ')}
                >
                  {columns.map(col => (
                    <TableCell key={col.key}>{renderCellValue(row, col)}</TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <p className="text-xs text-muted-foreground">{filteredData.length} of {data.length} records</p>
    </div>
  );
}

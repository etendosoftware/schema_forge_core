import React, { useState, useMemo } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { StatusBadge } from '@/components/ui/status-badge';
import { Search } from 'lucide-react';

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
 */
export function DataTable({ columns = [], filters = [], data = [], onRowSelect, selectedId, compact }) {
  const [filterValues, setFilterValues] = useState({});

  const setFilter = (key, value) => {
    setFilterValues(prev => ({ ...prev, [key]: value }));
  };

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
      return <StatusBadge status={row[col.key]} />;
    }
    if (col.type === 'amount') {
      return <span className="tabular-nums">{row[col.key]?.toLocaleString()}</span>;
    }
    return row[col.key];
  };

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
            {filteredData.map((row, idx) => (
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
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="text-xs text-muted-foreground">{filteredData.length} of {data.length} records</p>
    </div>
  );
}

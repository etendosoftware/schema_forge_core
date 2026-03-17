import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, Inbox, X, ChevronDown } from 'lucide-react';
import { FieldHighlight } from '@/components/inspector/FieldHighlight.jsx';
import { useLabel } from '@/i18n';
import { getStatusBadgeProps, statusLabel } from '@/lib/statusBadge.js';
import { resolveIdentifier } from '@/lib/resolveIdentifier.js';

/**
 * Compact inline combobox for search-type FK fields in rapid line entry.
 * Text input with filtered dropdown — lightweight alternative to full SearchInput.
 */
function InlineSearchCombo({ field, value, options, onChange, onKeyDown, placeholder, inputRef }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const displayValue = options.find(o => o.id === value);

  const filtered = useMemo(() => {
    if (!query) return options.slice(0, 15);
    const q = query.toLowerCase();
    return options.filter(o => {
      const name = o.name || o.label || o._identifier || '';
      return name.toLowerCase().includes(q);
    }).slice(0, 15);
  }, [query, options]);

  const handleSelect = (opt) => {
    setQuery(opt.name || opt.label || opt._identifier || '');
    onChange(opt.id, opt.name || opt.label || opt._identifier || '');
    setOpen(false);
  };

  // Sync display when value is set externally
  useEffect(() => {
    if (displayValue && !query) {
      setQuery(displayValue.name || displayValue.label || displayValue._identifier || '');
    }
  }, [value]);

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          // Clear ID when typing (user is searching, not committed yet)
          if (value) onChange('', '');
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          // Let Enter/Escape propagate to the row handler only if dropdown is closed
          if (e.key === 'Enter' && open && filtered.length > 0) {
            e.preventDefault();
            e.stopPropagation();
            handleSelect(filtered[0]);
            return;
          }
          onKeyDown?.(e);
        }}
        placeholder={placeholder}
        className="w-full h-8 text-sm rounded-md border border-input bg-background px-2 pr-6 focus:ring-2 focus:ring-primary focus:outline-none"
      />
      <ChevronDown className="absolute right-1.5 top-2 h-4 w-4 text-muted-foreground pointer-events-none" />
      {open && filtered.length > 0 && (
        <div className="absolute z-50 top-full left-0 mt-0.5 bg-white border rounded-md shadow-lg max-h-40 overflow-auto min-w-[200px] w-max">
          {filtered.map(opt => (
            <button
              key={opt.id}
              type="button"
              className="w-full text-left px-2 py-1.5 text-sm hover:bg-blue-50 cursor-pointer whitespace-nowrap"
              onMouseDown={(e) => { e.preventDefault(); handleSelect(opt); }}
            >
              {opt.name || opt.label || opt._identifier || opt.id}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Format a number as currency with $ prefix and locale-aware separators.
 * e.g. 324000 → "$324.000,00"
 */
function formatCurrency(value) {
  if (value == null || value === '') return '\u2014';
  const num = Number(value);
  if (isNaN(num)) return value;
  return '$' + num.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Return a colored dot class based on whether a date is past, future, or today.
 * Green = future (not yet due), Red = past (overdue), null = today or empty.
 */
function getDateDotColor(dateValue) {
  if (!dateValue) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(dateValue);
  d.setHours(0, 0, 0, 0);
  if (d.getTime() === today.getTime()) return null;
  return d > today ? 'bg-emerald-500' : 'bg-red-500';
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
 * Inline editable row rendered at the bottom of the table for rapid line entry.
 * Controlled by the `addRow` prop on DataTable.
 */
function InlineAddRow({ columns, fields, onAdd, onCancel, data, catalogs }) {
  const t = useLabel();
  const fieldMap = useMemo(() => {
    const map = {};
    for (const f of fields) map[f.key] = f;
    return map;
  }, [fields]);

  // Auto-compute lineNo default
  const defaultLineNo = useMemo(() => {
    const nums = (data || []).map(r => Number(r.lineNo) || 0);
    return (nums.length > 0 ? Math.max(...nums) : 0) + 10;
  }, [data]);

  const buildEmpty = useCallback(() => {
    const empty = {};
    for (const f of fields) {
      empty[f.key] = f.key === 'lineNo' ? defaultLineNo : '';
    }
    return empty;
  }, [fields, defaultLineNo]);

  const [values, setValues] = useState(buildEmpty);
  const firstInputRef = useRef(null);

  // Reset values when fields or data change
  useEffect(() => {
    setValues(buildEmpty());
  }, [buildEmpty]);

  // Auto-focus first input when row appears
  useEffect(() => {
    firstInputRef.current?.focus();
  }, []);

  const handleChange = (key, val) => {
    setValues(prev => ({ ...prev, [key]: val }));
  };

  const handleConfirm = () => {
    onAdd(values);
    // Reset for next rapid entry — recompute lineNo
    const nums = [...(data || []).map(r => Number(r.lineNo) || 0), Number(values.lineNo) || 0];
    const nextLineNo = Math.max(...nums) + 10;
    const next = {};
    for (const f of fields) {
      next[f.key] = f.key === 'lineNo' ? nextLineNo : '';
    }
    // Clear any $_identifier companion values
    for (const key of Object.keys(values)) {
      if (key.includes('$_identifier') && !(key in next)) {
        next[key] = '';
      }
    }
    setValues(next);
    // Re-focus first input for rapid entry
    setTimeout(() => firstInputRef.current?.focus(), 0);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleConfirm();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  };

  let firstInputAssigned = false;

  return (
    <TableRow className="bg-blue-50/50 border-t-2 border-primary/20">
      {columns.map(col => {
        const field = fieldMap[col.key];
        if (!field) {
          return (
            <TableCell key={col.key} className="text-muted-foreground text-sm">
              &mdash;
            </TableCell>
          );
        }
        const isFirst = !firstInputAssigned;
        if (isFirst) firstInputAssigned = true;

        // Search fields render as compact combobox (text input + filtered dropdown)
        if (field.type === 'search' && catalogs?.[field.reference]) {
          const options = catalogs[field.reference] || [];
          return (
            <TableCell key={col.key} className="py-1 px-2">
              <InlineSearchCombo
                field={field}
                value={values[field.key] ?? ''}
                options={options}
                inputRef={isFirst ? firstInputRef : undefined}
                placeholder={t(field.column) ?? field.label ?? field.key}
                onChange={(id, label) => {
                  handleChange(field.key, id);
                  handleChange(field.key + '$_identifier', label);
                }}
                onKeyDown={handleKeyDown}
              />
            </TableCell>
          );
        }

        // Selector fields render as native <select> dropdowns (few options)
        if (field.type === 'selector' && catalogs?.[field.reference]) {
          const options = catalogs[field.reference] || [];
          return (
            <TableCell key={col.key} className="py-1 px-2">
              <select
                ref={isFirst ? firstInputRef : undefined}
                value={values[field.key] ?? ''}
                onChange={(e) => {
                  const selectedId = e.target.value;
                  handleChange(field.key, selectedId);
                  const opt = options.find(o => o.id === selectedId);
                  if (opt) {
                    handleChange(field.key + '$_identifier', opt.name || opt.label || opt._identifier || '');
                  }
                }}
                onKeyDown={handleKeyDown}
                className="w-full h-8 text-sm rounded-md border border-input bg-background px-2 focus:ring-2 focus:ring-primary focus:outline-none"
              >
                <option value="">{t(field.column) ?? field.label ?? field.key}</option>
                {options.map(opt => (
                  <option key={opt.id} value={opt.id}>{opt.name || opt.label || opt._identifier || opt.id}</option>
                ))}
              </select>
            </TableCell>
          );
        }

        return (
          <TableCell key={col.key} className="py-1 px-2">
            <input
              ref={isFirst ? firstInputRef : undefined}
              type={field.type === 'number' ? 'number' : 'text'}
              inputMode={field.inputMode}
              value={values[field.key] ?? ''}
              onChange={(e) => handleChange(field.key, e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t(field.column) ?? field.label ?? field.key}
              required={field.required}
              className="w-full h-8 text-sm rounded-md border border-input bg-background px-2 focus:ring-2 focus:ring-primary focus:outline-none"
            />
          </TableCell>
        );
      })}
    </TableRow>
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
 *  - onNavigate: (row) => void — when provided, clicking a row calls onNavigate instead of onRowSelect
 *  - selectedId: string | number
 *  - compact: boolean (reserved for narrower layout)
 *  - loading: boolean (shows skeleton when true)
 *  - addRow: { active, fields, onAdd, onCancel, catalogs } — inline add row config
 */
export function DataTable({ entity, columns = [], filters = [], data = [], onRowSelect, onNavigate, selectedId, compact, loading, addRow, selectable = true, onSelectionChange, sortColumn, sortDirection, onColumnsReady }) {
  const t = useLabel();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRows, setSelectedRows] = useState(new Set());

  // Report columns to parent (e.g., ListView sort popover)
  useEffect(() => {
    if (onColumnsReady && columns.length > 0) {
      onColumnsReady(columns);
    }
  }, [columns, onColumnsReady]);

  const hasActiveFilter = searchQuery.length > 0;

  const filteredData = useMemo(() => {
    if (!searchQuery) return data;
    const q = searchQuery.toLowerCase();
    return data.filter(row =>
      filters.some(key => {
        const val = resolveIdentifier(row, key);
        return String(val ?? '').toLowerCase().includes(q);
      })
    );
  }, [data, filters, searchQuery]);

  const amountColumns = useMemo(
    () => columns.filter(col => col.type === 'amount'),
    [columns]
  );

  const totals = useMemo(() => {
    if (amountColumns.length === 0) return null;
    const sums = {};
    for (const col of amountColumns) {
      sums[col.key] = filteredData.reduce((sum, row) => sum + (Number(row[col.key]) || 0), 0);
    }
    return sums;
  }, [filteredData, amountColumns]);

  const renderCellValue = (row, col) => {
    const display = resolveIdentifier(row, col.key);
    // Link styling on first string column
    if (col === columns[0] && col.type === 'string') {
      return <span className="font-medium text-blue-600">{display}</span>;
    }
    if (col.type === 'status') {
      const badgeProps = getStatusBadgeProps(row[col.key]);
      return <Badge {...badgeProps}>{statusLabel(row[col.key])}</Badge>;
    }
    if (col.type === 'boolean') {
      const val = row[col.key];
      if (val === true || val === 'Y') return <span className="text-emerald-600">Yes</span>;
      if (val === false || val === 'N') return <span className="text-slate-400">No</span>;
      return <span className="text-slate-300">&mdash;</span>;
    }
    if (col.type === 'date') {
      const dotColor = getDateDotColor(row[col.key]);
      const formatted = row[col.key]
        ? new Date(row[col.key]).toLocaleDateString()
        : '\u2014';
      return (
        <span className="inline-flex items-center gap-1.5">
          {formatted}
          {dotColor && <span className={`inline-block h-2 w-2 rounded-full ${dotColor}`} />}
        </span>
      );
    }
    if (col.type === 'amount') {
      return <span className="tabular-nums">{formatCurrency(row[col.key])}</span>;
    }
    // Truncate long display values
    const val = display;
    if (typeof val === 'string' && val.length > 30) {
      return <span className="block max-w-[200px] truncate" title={val}>{val}</span>;
    }
    return val;
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <TableSkeleton columns={columns.length > 0 ? columns : [{ key: '_1' }, { key: '_2' }, { key: '_3' }]} />
      </div>
    );
  }

  const allSelected = filteredData.length > 0 && selectedRows.size === filteredData.length;
  const someSelected = selectedRows.size > 0 && !allSelected;

  const toggleAll = (e) => {
    e.stopPropagation();
    if (allSelected) {
      setSelectedRows(new Set());
      onSelectionChange?.([]);
    } else {
      const allIds = new Set(filteredData.map(r => r.id));
      setSelectedRows(allIds);
      onSelectionChange?.(filteredData);
    }
  };

  const toggleRow = (e, row) => {
    e.stopPropagation();
    setSelectedRows(prev => {
      const next = new Set(prev);
      if (next.has(row.id)) next.delete(row.id);
      else next.add(row.id);
      onSelectionChange?.(filteredData.filter(r => next.has(r.id)));
      return next;
    });
  };

  const colSpan = columns.length + (selectable ? 1 : 0);

  return (
    <div className="space-y-0">
      <div className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-border/40">
              {selectable && (
                <TableHead className="w-10 px-3" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={el => { if (el) el.indeterminate = someSelected; }}
                    onChange={toggleAll}
                    onClick={(e) => e.stopPropagation()}
                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                  />
                </TableHead>
              )}
              {columns.map(col => {
                const colLabel = t(col.column) ?? col.label ?? col.key;
                const isSorted = sortColumn === col.key;
                return (
                  <TableHead key={col.key} className={`text-xs font-medium text-muted-foreground/70 tracking-wide ${col.type === 'amount' ? 'text-right' : ''}`}>
                    <FieldHighlight entityName={entity} fieldName={col.key}>
                      {colLabel}
                      {isSorted && (
                        <span className="ml-1 text-primary/70">{sortDirection === 'asc' ? '\u25B2' : '\u25BC'}</span>
                      )}
                    </FieldHighlight>
                  </TableHead>
                );
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={colSpan} className="p-0">
                  <EmptyState hasFilter={hasActiveFilter} totalCount={data.length} />
                </TableCell>
              </TableRow>
            ) : (
              filteredData.map((row, idx) => {
                const isChecked = selectedRows.has(row.id);
                return (
                  <TableRow
                    key={row.id ?? idx}
                    onClick={() => onNavigate ? onNavigate(row) : onRowSelect?.(row)}
                    className={[
                      'cursor-pointer transition-colors h-12',
                      isChecked ? 'bg-primary/5' : '',
                      row.id === selectedId ? 'bg-primary/10' : '',
                      'hover:bg-muted/50',
                    ].filter(Boolean).join(' ')}
                  >
                    {selectable && (
                      <TableCell className="w-10 px-3" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => toggleRow(e, row)}
                          onClick={(e) => e.stopPropagation()}
                          className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                        />
                      </TableCell>
                    )}
                    {columns.map(col => (
                      <TableCell key={col.key} className={col.type === 'amount' ? 'text-right' : ''}>
                        {renderCellValue(row, col)}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })
            )}
            {addRow?.active && (
              <InlineAddRow
                columns={columns}
                fields={addRow.fields}
                onAdd={addRow.onAdd}
                onCancel={addRow.onCancel}
                data={data}
                catalogs={addRow.catalogs}
              />
            )}
          </TableBody>
          {totals && (
            <TableFooter>
              <TableRow className="font-medium">
                {selectable && <TableCell />}
                {columns.map((col, idx) => (
                  <TableCell key={col.key} className={col.type === 'amount' ? 'tabular-nums text-right font-semibold' : ''}>
                    {col.type === 'amount'
                      ? formatCurrency(totals[col.key])
                      : ''}
                  </TableCell>
                ))}
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </div>
      {addRow?.active && (
        <p className="text-xs text-muted-foreground mt-1 text-center">
          Enter to add &middot; Esc to cancel
        </p>
      )}
    </div>
  );
}

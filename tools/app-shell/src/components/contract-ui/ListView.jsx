import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button.jsx';
import { Skeleton } from '@/components/ui/skeleton.jsx';
import { useEntity } from '@/hooks/useEntity';
import { useMenuLabel, useLabel, useUI } from '@/i18n';
import { useSetPageMeta } from '@/components/layout/PageMetaContext';
import { useFavorites } from '@/components/layout/FavoritesContext';
import { Search, ArrowUpDown, ChevronDown, MoreVertical, Plus, Link2, Printer, LayoutGrid, LayoutList, RefreshCw, Eye, Copy } from 'lucide-react';
import ReportDrawer from './ReportDrawer.jsx';
import DocumentPrintDrawer, { printDocuments } from './DocumentPrintDrawer.jsx';
import { ListFilterBar } from './ListFilterBar.jsx';
import { buildAdvancedFilterCriteria } from '@/lib/gridQuery';
import { useWindowFilterPresets } from '@/hooks/useWindowFilterPresets';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu.jsx';

/**
 * Full-width list view for an entity.
 */
export function ListView({
  entity,
  Table,
  entityLabel,
  windowName,
  token,
  apiBaseUrl,
  breadcrumb,
  galleryRenderer,
  hideCreate = false,
  hidePrint = false,
  hideMoreMenu = false,
  hideListFilters = false,
  hideLink = false,
  hideEyeCount = false,
  headerContent = null,
  api = null,
  bulkActions = null,
  isRowSelectable = null,
  listViewOptions = {},
  baseFilter = null,
  quickFilters = null,
  initialQuickFilterIndex = null,
  subsetFilters = null,
  initialSubsetIndex = 0,
  onNew = null,
  newActions = [],
  labelOverrides,
  onCloneRow = null,
  initialColumnFilters,
  rowFilter,
  dateFilterKey = null,
  refreshTrigger = 0,
}) {
  // Subset filters — radio-style, always one active, applied first.
  const [activeSubsetIndex, setActiveSubsetIndex] = useState(() => {
    if (!subsetFilters?.length) return null;
    const idx = initialSubsetIndex != null && subsetFilters[initialSubsetIndex] ? initialSubsetIndex : 0;
    return idx;
  });

  const selectSubset = useCallback((i) => {
    setActiveSubsetIndex(i);
  }, []);

  // Quick filters — independent toggles, refine the current subset.
  const [activeFilterIndices, setActiveFilterIndices] = useState(() =>
    initialQuickFilterIndex != null && quickFilters?.[initialQuickFilterIndex]
      ? new Set([initialQuickFilterIndex])
      : new Set(),
  );

  const toggleQuickFilter = useCallback((i) => {
    setActiveFilterIndices(prev => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }, []);

  // Advanced filter (funnel popover) — ephemeral state, lost on page refresh.
  const [advancedFilter, setAdvancedFilter] = useState(null);

  const [tableColumns, setTableColumns] = useState([]);

  const advancedFilterPart = useMemo(() => {
    const criteria = buildAdvancedFilterCriteria(advancedFilter, tableColumns);
    if (!criteria || criteria.length === 0) return null;
    return `criteria=${encodeURIComponent(JSON.stringify(criteria))}`;
  }, [advancedFilter, tableColumns]);

  const effectiveFilter = useMemo(() => {
    // Composition here covers window-scope filters only:
    //   baseFilter AND subset AND quick[]
    // Column filters (status/date/search) and the funnel are applied downstream
    // by useEntity so they sort after this block in the final criteria array.
    const parts = [];
    if (baseFilter) parts.push(baseFilter);
    if (subsetFilters && activeSubsetIndex != null) {
      const f = subsetFilters[activeSubsetIndex]?.filter;
      if (f) parts.push(f);
    }
    if (quickFilters && activeFilterIndices.size > 0) {
      const qfParts = [...activeFilterIndices]
        .sort()
        .map(i => quickFilters[i]?.filter)
        .filter(Boolean);
      parts.push(...qfParts);
    }
    if (parts.length === 0) return null;

    // Split each part into criteria payload + passthrough query params.
    const allCriteria = [];
    const passthrough = new URLSearchParams();
    for (const filterStr of parts) {
      const params = new URLSearchParams(filterStr);
      for (const [k, v] of params.entries()) {
        if (k === 'criteria') {
          try {
            const parsed = JSON.parse(v);
            allCriteria.push(...(Array.isArray(parsed) ? parsed : [parsed]));
          } catch {}
        } else {
          passthrough.append(k, v);
        }
      }
    }

    const segments = [];
    if (allCriteria.length > 0) {
      // If any part introduced an AdvancedCriteria (e.g. the funnel's OR block),
      // wrap the whole outer merge in an AdvancedCriteria AND so the OR stays
      // parenthesized instead of leaking into the top-level AND array.
      const hasAdvanced = allCriteria.some((c) => c && c._constructor === 'AdvancedCriteria');
      const finalCriteria = hasAdvanced
        ? { _constructor: 'AdvancedCriteria', operator: 'and', criteria: allCriteria }
        : allCriteria;
      segments.push(`criteria=${encodeURIComponent(JSON.stringify(finalCriteria))}`);
    }
    const passthroughStr = passthrough.toString();
    if (passthroughStr) segments.push(passthroughStr);
    return segments.length > 0 ? segments.join('&') : null;
  }, [subsetFilters, activeSubsetIndex, quickFilters, activeFilterIndices, baseFilter]);

  const effectiveRowFilter = useMemo(() => {
    const fns = [];
    if (subsetFilters && activeSubsetIndex != null) {
      const fn = subsetFilters[activeSubsetIndex]?.rowFilter;
      if (fn) fns.push(fn);
    }
    if (quickFilters && activeFilterIndices.size > 0) {
      const qfFns = [...activeFilterIndices]
        .map(i => quickFilters[i]?.rowFilter)
        .filter(Boolean);
      fns.push(...qfFns);
    }
    if (rowFilter) fns.push(rowFilter);
    if (fns.length === 0) return null;
    if (fns.length === 1) return fns[0];
    return (item) => fns.every(fn => fn(item));
  }, [subsetFilters, activeSubsetIndex, quickFilters, activeFilterIndices, rowFilter]);

  const [columnFilters, setColumnFilters] = useState(initialColumnFilters ?? {});
  const columnDefs = useMemo(
    () => Object.fromEntries(tableColumns.map(c => [c.key, c])),
    [tableColumns],
  );

  const handleFilterChange = useCallback((key, parsed) => {
    setColumnFilters(prev => {
      const next = { ...prev };
      if (parsed) next[key] = parsed;
      else delete next[key];
      return next;
    });
  }, []);

  const handleClearAllFilters = useCallback(() => {
    setColumnFilters({});
  }, []);

  // Named filter presets — per-user, per-window, persisted via AD_Preference.
  const { presets: filterPresets, savePreset, deletePreset } = useWindowFilterPresets(windowName);

  const applyPreset = useCallback((name) => {
    const preset = filterPresets?.[name];
    if (!preset) return;
    setColumnFilters(preset.columnFilters && typeof preset.columnFilters === 'object' ? preset.columnFilters : {});
    setAdvancedFilter(preset.advancedFilter ?? null);

    // Subset and quick filters are stored by label (stable across prop
    // reorderings); resolve back to the current prop index, falling back to
    // the default if a label no longer exists.
    if (subsetFilters?.length) {
      const target = preset.subsetLabel
        ? subsetFilters.findIndex((f) => f?.label === preset.subsetLabel)
        : -1;
      setActiveSubsetIndex(target >= 0 ? target : (subsetFilters[0] ? 0 : null));
    }

    if (quickFilters?.length) {
      const labels = Array.isArray(preset.quickFilterLabels) ? preset.quickFilterLabels : [];
      const next = new Set();
      for (const label of labels) {
        const idx = quickFilters.findIndex((f) => f?.label === label);
        if (idx >= 0) next.add(idx);
      }
      setActiveFilterIndices(next);
    } else {
      setActiveFilterIndices(new Set());
    }
  }, [filterPresets, subsetFilters, quickFilters]);

  const saveCurrentAsPreset = useCallback((name) => {
    const subsetLabel = (subsetFilters && activeSubsetIndex != null)
      ? (subsetFilters[activeSubsetIndex]?.label ?? null)
      : null;
    const quickFilterLabels = quickFilters
      ? [...activeFilterIndices]
          .map((i) => quickFilters[i]?.label)
          .filter(Boolean)
      : [];
    savePreset(name, {
      columnFilters,
      advancedFilter,
      subsetLabel,
      quickFilterLabels,
    });
  }, [savePreset, columnFilters, advancedFilter, subsetFilters, activeSubsetIndex, quickFilters, activeFilterIndices]);

  const didInitialFetchRef = useRef(false);

  const hook = useEntity(entity, null, {
    token,
    apiBaseUrl,
    baseFilter: effectiveFilter,
    columnDefs,
    columnFilters,
    trailingFilter: advancedFilterPart,
  });

  const refreshRef = useRef(hook.refresh);
  refreshRef.current = hook.refresh;

  useEffect(() => {
    if (!didInitialFetchRef.current) {
      didInitialFetchRef.current = true;
      return;
    }
    refreshRef.current?.();
  }, [columnFilters, effectiveFilter, advancedFilterPart, hook.sortColumn, hook.sortDirection]);

  // External refresh signal — increments when the host wants to force a reload
  // (e.g. after cloning records via CloneOrderModal).
  const lastRefreshTriggerRef = useRef(refreshTrigger);
  useEffect(() => {
    if (refreshTrigger === lastRefreshTriggerRef.current) return;
    lastRefreshTriggerRef.current = refreshTrigger;
    refreshRef.current?.();
  }, [refreshTrigger]);

  const navigate = useNavigate();
  const tMenu = useMenuLabel();
  const t = useLabel();
  const ui = useUI();
  const label = tMenu(entityLabel) || entityLabel || entity;
  const { toggleFavorite, isFavorite } = useFavorites();
  const favKey = windowName || entity || '';
  const favActive = isFavorite(favKey);
  const fullBreadcrumb = breadcrumb
    ? breadcrumb.split(' / ').map(s => tMenu(s.trim())).join(' / ')
    : label;
  useSetPageMeta({
    title: label,
    breadcrumb: fullBreadcrumb,
    recordCount: hook.items.length,
    onAddToFavorites: favKey ? () => toggleFavorite(favKey, entityLabel || entity) : undefined,
    isFavorite: favActive,
  }, [favActive, hook.items.length]);
  const [selectedRows, setSelectedRows] = useState([]);
  const [showSortPopover, setShowSortPopover] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [showDocPrint, setShowDocPrint] = useState(false);
  const [viewMode, setViewMode] = useState(() =>
    localStorage.getItem(`viewMode:${entity}`) || 'list'
  );

  const handleViewMode = (mode) => {
    setViewMode(mode);
    localStorage.setItem(`viewMode:${entity}`, mode);
  };

  const sortBtnRef = useRef(null);
  const scrollRef = useRef(null);

  const isDefaultSort = hook.sortColumn === 'creationDate' && hook.sortDirection === 'desc';

  // Close sort popover on outside click
  useEffect(() => {
    if (!showSortPopover) return;
    const handleClick = (e) => {
      if (sortBtnRef.current && !sortBtnRef.current.contains(e.target)) {
        setShowSortPopover(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showSortPopover]);

  const handleSortSelect = useCallback((colKey) => {
    if (hook.sortColumn === colKey) {
      // Toggle direction
      hook.setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      hook.setSortColumn(colKey);
      hook.setSortDirection('asc');
    }
    setShowSortPopover(false);
  }, [hook.sortColumn, hook.setSortColumn, hook.setSortDirection]);

  // Header click: none → asc → desc → clear
  const handleColumnSort = useCallback((colKey) => {
    if (hook.sortColumn !== colKey) {
      hook.setSortColumn(colKey);
      hook.setSortDirection('asc');
    } else if (hook.sortDirection === 'asc') {
      hook.setSortDirection('desc');
    } else {
      hook.setSortColumn('creationDate');
      hook.setSortDirection('desc');
    }
  }, [hook.sortColumn, hook.sortDirection, hook.setSortColumn, hook.setSortDirection]);

  const handleClearSort = useCallback(() => {
    hook.setSortColumn('creationDate');
    hook.setSortDirection('desc');
    setShowSortPopover(false);
  }, [hook.setSortColumn, hook.setSortDirection]);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 200 && hook.hasMore && !hook.loadingMore) {
      hook.loadMore();
    }
  }, [hook.hasMore, hook.loadingMore, hook.loadMore]);

  return (
    <div className="flex-1 min-h-0 flex flex-col" data-testid="list-view">
      {/* White content card with rounded top-left corner */}
      <div className="flex-1 flex flex-col bg-white rounded-tl-2xl overflow-hidden min-h-0">
        {/* Selection bar or filter bar */}
        {selectedRows.length > 0 ? (
          <div className="flex items-center justify-between px-6 py-3 border-b border-border/30">
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold">{ui('selected').replace('{count}', selectedRows.length)}</span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => setShowDocPrint(true)}
              >
                <Eye className="h-3.5 w-3.5" />
                {ui('preview')}
              </Button>
              <Button
                size="sm"
                className="gap-1.5"
                onClick={() => printDocuments(windowName, selectedRows.map(r => r.id || r), token)}
              >
                <Printer className="h-3.5 w-3.5" />
                {ui('print')} ({selectedRows.length})
              </Button>
              {onCloneRow && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => onCloneRow(selectedRows)}
                >
                  <Copy className="h-3.5 w-3.5" />
                  {ui('cloneOrderBtn')} ({selectedRows.length})
                </Button>
              )}
              {bulkActions && bulkActions({ selectedRows, clearSelection: () => setSelectedRows([]), token, apiBaseUrl, windowName, api })}
              <Button variant="outline" size="sm" className="text-muted-foreground" onClick={() => setSelectedRows([])}>
                {ui('clear')}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between px-6 py-3">
            <div className="flex items-center gap-2">
              {subsetFilters && (
                <div className="inline-flex items-center rounded-lg border border-border overflow-hidden">
                  {subsetFilters.map((sf, i) => (
                    <button
                      key={i}
                      onClick={() => selectSubset(i)}
                      className={[
                        'h-9 px-3 text-xs transition-colors',
                        i > 0 ? 'border-l border-border' : '',
                        activeSubsetIndex === i
                          ? 'bg-primary/5 text-primary font-medium'
                          : 'text-muted-foreground hover:text-foreground',
                      ].join(' ')}
                    >
                      {ui(sf.label)}
                    </button>
                  ))}
                </div>
              )}
              {quickFilters && (
                <div className="flex items-center gap-1">
                  {quickFilters.map((qf, i) => (
                    <button
                      key={i}
                      onClick={() => toggleQuickFilter(i)}
                      className={[
                        'h-9 px-3 text-xs rounded-lg border bg-white transition-colors',
                        activeFilterIndices.has(i)
                          ? 'border-primary text-primary bg-primary/5 font-medium'
                          : 'border-border text-muted-foreground hover:text-foreground',
                      ].join(' ')}
                    >
                      {ui(qf.label)}
                    </button>
                  ))}
                </div>
              )}
              {!(listViewOptions?.hideFilters ?? hideListFilters) && (
                <ListFilterBar
                  entity={entity}
                  apiBaseUrl={apiBaseUrl}
                  columns={tableColumns}
                  columnFilters={columnFilters}
                  onFilterChange={handleFilterChange}
                  advancedFilter={advancedFilter}
                  onAdvancedFilterChange={setAdvancedFilter}
                  rows={hook.items}
                  dateFilterKey={dateFilterKey}
                  presets={windowName ? filterPresets : null}
                  onApplyPreset={windowName ? applyPreset : null}
                  onSavePreset={windowName ? saveCurrentAsPreset : null}
                  onDeletePreset={windowName ? deletePreset : null}
                />
              )}
            </div>
            <div className="flex items-center gap-2">
              {!(listViewOptions?.hideLink ?? hideLink) && (
                <button className="h-9 w-9 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground transition-colors">
                  <Link2 className="h-4 w-4" />
                </button>
              )}
              <div className="relative" ref={sortBtnRef}>
                <button
                  onClick={() => setShowSortPopover(v => !v)}
                  className={[
                    'h-9 w-9 flex items-center justify-center rounded-lg border transition-colors',
                    isDefaultSort
                      ? 'border-border text-muted-foreground hover:text-foreground'
                      : 'border-primary/40 bg-primary/10 text-primary',
                  ].join(' ')}
                >
                  <ArrowUpDown className="h-4 w-4" />
                </button>
                {showSortPopover && tableColumns.length > 0 && (
                  <div className="absolute right-0 top-full mt-1 z-50 w-56 rounded-lg border border-border bg-card shadow-lg py-1">
                    <div className="px-3 py-2 text-xs font-medium text-muted-foreground tracking-wide">
                      {ui('sortBy')}
                    </div>
                    {tableColumns.map(col => {
                      const colLabel = t(col.column) ?? col.label ?? col.key;
                      const isActive = hook.sortColumn === col.key;
                      return (
                        <button
                          key={col.key}
                          onClick={() => handleSortSelect(col.key)}
                          className={[
                            'w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors',
                            isActive ? 'bg-primary/5 text-foreground font-medium' : 'text-foreground hover:bg-muted/50',
                          ].join(' ')}
                        >
                          <span className="w-4 text-center text-xs">
                            {isActive ? (hook.sortDirection === 'asc' ? '\u25B2' : '\u25BC') : ''}
                          </span>
                          <span className="flex-1 text-left">{colLabel}</span>
                        </button>
                      );
                    })}
                    {!isDefaultSort && (
                      <>
                        <div className="border-t border-border/50 my-1" />
                        <button
                          onClick={handleClearSort}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:bg-muted/50 transition-colors"
                        >
                          <span className="w-4" />
                          <span className="flex-1 text-left">{ui('clearSort')}</span>
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
              <button
                onClick={() => hook.refresh()}
                className="h-9 w-9 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground transition-colors"
                title={ui('refresh') || 'Refresh'}
              >
                <RefreshCw className="h-4 w-4" />
              </button>
              {!(listViewOptions?.hidePrint ?? hidePrint) && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-muted-foreground font-normal h-9 px-3 rounded-lg bg-white"
                  onClick={() => setShowReport(true)}
                >
                  <Printer className="h-3.5 w-3.5" />
                  {ui('print')}
                </Button>
              )}
              {/* View toggle */}
              {galleryRenderer && (
                <div className="inline-flex items-center border border-border rounded-lg overflow-hidden">
                  <button
                    onClick={() => handleViewMode('list')}
                    className={`h-9 w-9 flex items-center justify-center transition-colors ${viewMode === 'list' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    <LayoutList className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleViewMode('gallery')}
                    className={`h-9 w-9 flex items-center justify-center transition-colors ${viewMode === 'gallery' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    <LayoutGrid className="h-4 w-4" />
                  </button>
                </div>
              )}
              {/* Split "New" button */}
              {!hideCreate && (
              <div className="inline-flex items-stretch rounded-lg overflow-hidden shadow-sm ml-3">
                <Button
                  className="rounded-none rounded-l-lg gap-1.5 px-4"
                  data-testid="action-new"
                  onClick={() => onNew ? onNew() : navigate(`/${windowName}/new`)}
                >
                  <Plus className="h-4 w-4" />
                  {ui('newRecord')}
                </Button>
                {newActions.length > 0 && (
                  <>
                    <div className="w-px bg-primary-foreground/20" />
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button className="rounded-none rounded-r-lg px-2" data-testid="action-new-more">
                          <ChevronDown className="h-3.5 w-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {newActions.map((action) => (
                          <DropdownMenuItem
                            key={action.key}
                            onClick={action.onClick}
                            data-testid={`action-new-${action.key}`}
                          >
                            {action.label}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </>
                )}
              </div>
              )}
            </div>
          </div>
        )}

        {/* KPI / header content */}
        {headerContent && (
          <div className="px-6 pt-4">
            {typeof headerContent === 'function'
              ? headerContent({ api, token, apiBaseUrl, items: hook.items, loading: hook.loading })
              : headerContent}
          </div>
        )}

        {/* Indeterminate top progress bar — visible while refreshing existing data */}
        {hook.loading && hook.items.length > 0 && (
          <>
            <div className="h-0.5 w-full overflow-hidden bg-primary/10">
              <div
                className="h-full w-1/3 bg-primary"
                style={{ animation: 'sf-list-progress 1.1s ease-in-out infinite' }}
              />
            </div>
            <style>{`@keyframes sf-list-progress { 0% { transform: translateX(-100%) } 100% { transform: translateX(400%) } }`}</style>
          </>
        )}

        {/* Table */}
        <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-auto px-6 pb-6">
          {hook.loading && hook.items.length === 0 ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : (
            <div className={hook.loading ? 'opacity-70 transition-opacity duration-200' : 'transition-opacity duration-200'}>
              {viewMode === 'gallery' && galleryRenderer
                ? galleryRenderer({ data: hook.items, onNavigate: (id) => navigate(`/${windowName}/${id}`), token, apiBaseUrl })
                : (
                  <Table
                    entity={entity}
                    data={hook.items}
                    onNavigate={(row) => navigate(`/${windowName}/${row.id}`)}
                    onSelectionChange={setSelectedRows}
                    onDataMutated={hook.refresh}
                    isRowSelectable={isRowSelectable}
                    compact={false}
                    sortColumn={hook.sortColumn}
                    sortDirection={hook.sortDirection}
                    onSort={handleColumnSort}
                    onColumnsReady={setTableColumns}
                    api={api}
                    token={token}
                    apiBaseUrl={apiBaseUrl}
                    labelOverrides={labelOverrides}
                    onFilterChange={handleFilterChange}
                    onClearAllFilters={handleClearAllFilters}
                    columnFilters={columnFilters}
                    onCloneRow={onCloneRow}
                    rowFilter={effectiveRowFilter}
                  />
                )
              }
              {hook.loadingMore && (
                <div className="flex items-center justify-center py-4">
                  <div className="h-5 w-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                  <span className="ml-2 text-sm text-muted-foreground">{ui('loadingMore')}</span>
                </div>
              )}
              {!hook.hasMore && hook.items.length > 0 && !hook.loadingMore && (
                <p className="text-center text-xs text-muted-foreground/60 py-3">{ui('allRecordsLoaded')}</p>
              )}
            </div>
          )}
        </div>
      </div>
      <ReportDrawer
        open={showReport}
        onClose={() => setShowReport(false)}
        windowName={windowName}
        columns={tableColumns.map(col => ({ ...col, label: t(col.column) ?? col.label ?? col.key }))}
        title={label}
        apiBaseUrl={apiBaseUrl}
        entity={entity}
        token={token}
        sortColumn={hook.sortColumn}
        sortDirection={hook.sortDirection}
      />
      <DocumentPrintDrawer
        open={showDocPrint}
        onClose={() => setShowDocPrint(false)}
        windowName={windowName}
        documentIds={selectedRows.map(r => r.id || r)}
        token={token}
      />
    </div>
  );
}

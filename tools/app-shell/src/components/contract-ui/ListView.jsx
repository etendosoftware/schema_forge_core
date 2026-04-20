import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button.jsx';
import { Skeleton } from '@/components/ui/skeleton.jsx';
import { useEntity } from '@/hooks/useEntity';
import { useMenuLabel, useLabel, useUI } from '@/i18n';
import { useSetPageMeta } from '@/components/layout/PageMetaContext';
import { useFavorites } from '@/components/layout/FavoritesContext';
import { Search, ArrowUpDown, SlidersHorizontal, ChevronDown, MoreVertical, Plus, CalendarDays, Link2, Printer, LayoutGrid, LayoutList, RefreshCw, Eye } from 'lucide-react';
import ReportDrawer from './ReportDrawer.jsx';
import DocumentPrintDrawer, { printDocuments } from './DocumentPrintDrawer.jsx';
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
  initialQuickFilterIndex = 0,
  onNew = null,
  newActions = [],
  labelOverrides,
  onCloneRow = null,
  initialColumnFilters,
  rowFilter,
}) {
  const [activeFilterIndex, setActiveFilterIndex] = useState(initialQuickFilterIndex ?? 0);
  const effectiveFilter = quickFilters
    ? (quickFilters[activeFilterIndex]?.filter ?? baseFilter)
    : baseFilter;
  const effectiveRowFilter = quickFilters?.[activeFilterIndex]?.rowFilter ?? rowFilter;
  const hook = useEntity(entity, null, { token, apiBaseUrl, baseFilter: effectiveFilter });
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
    onAddToFavorites: favKey ? () => toggleFavorite(favKey, label) : undefined,
    isFavorite: favActive,
  }, [favActive, hook.items.length]);
  const [selectedRows, setSelectedRows] = useState([]);
  const [showSortPopover, setShowSortPopover] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [showDocPrint, setShowDocPrint] = useState(false);
  const [tableColumns, setTableColumns] = useState([]);
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
              {bulkActions && bulkActions({ selectedRows, clearSelection: () => setSelectedRows([]), token, apiBaseUrl, windowName, api })}
              <Button variant="outline" size="sm" className="text-muted-foreground" onClick={() => setSelectedRows([])}>
                {ui('clear')}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between px-6 py-3">
            <div className="flex items-center gap-2">
              {quickFilters && (
                <div className="flex items-center gap-1">
                  {quickFilters.map((qf, i) => (
                    <button
                      key={i}
                      onClick={() => setActiveFilterIndex(i)}
                      className={[
                        'h-9 px-4 text-sm rounded-lg border transition-colors',
                        activeFilterIndex === i
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
                <>
                  <Button variant="outline" size="sm" className="gap-1.5 text-muted-foreground font-normal h-9 px-3 rounded-lg bg-white">
                    {ui('allStatuses')}
                    <ChevronDown className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="outline" size="sm" className="gap-1.5 text-muted-foreground font-normal h-9 px-3 rounded-lg bg-white">
                    <CalendarDays className="h-3.5 w-3.5" />
                    {ui('lastYear')}
                    <ChevronDown className="h-3.5 w-3.5" />
                  </Button>
                  <button className="h-9 w-9 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground transition-colors">
                    <SlidersHorizontal className="h-4 w-4" />
                  </button>
                </>
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

        {/* Table */}
        <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-auto px-6 pb-6">
          {hook.loading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : (
            <>
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
                    onCloneRow={onCloneRow}
                    initialColumnFilters={initialColumnFilters}
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
            </>
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

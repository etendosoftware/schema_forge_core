import { useRef, useState } from 'react';
import { RotateCw, Ban, AlertCircle, ChevronDown, Check } from 'lucide-react';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../ui/table.jsx';
import { Input } from '../ui/input.jsx';
import { Button } from '../ui/button.jsx';
import { Popover, PopoverTrigger, PopoverContent } from '../ui/popover.jsx';
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from '../ui/command.jsx';
import { Dialog, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription } from '../ui/dialog.jsx';
import { ScrollPane } from '../ui/scroll-pane.jsx';
import { csvField } from '../../lib/csv/csvSerializer.js';

const DEFAULT_LABELS = {
  filterAll: 'All',
  filterOk: 'Correct',
  filterError: 'Errors',
  skip: 'Skip',
  skipped: 'Skipped',
  unskip: 'Edit again',
  downloadErrors: 'Download errors',
  status: 'Status',
  statusOk: 'OK',
  statusError: 'Error',
  fieldErrorsTooltip: 'Errors in: {fields} — scroll right to see them.',
  bulkApplyTitle: 'Apply to similar rows?',
  bulkApplyDescription: '{count} other row(s) also have "{raw}". Apply "{value}" to all of them too?',
  bulkApplyOnlyThis: 'Just this row',
  bulkApplyAll: 'Apply to all',
};

/** Fills `{key}` placeholders in a label template — e.g. bulkApplyDescription's {count}/{raw}/{value}. */
function formatTemplate(template, vars) {
  return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? '');
}

// Three-way status filter — 'error' bundles skipped rows in with actual
// validation errors, since both need the user's attention; 'ok' is only rows
// that are ready to send as-is.
const STATUS_FILTERS = [
  { value: 'all', labelKey: 'filterAll' },
  { value: 'ok', labelKey: 'filterOk' },
  { value: 'error', labelKey: 'filterError' },
];

// Fixed per-column widths (paired with `table-fixed` on <Table>) so every
// cell is capped to a single line with a predictable, ellipsis-on-overflow
// truncation — a data grid with values of wildly different lengths (a short
// postal code next to a long address) is otherwise nearly impossible to keep
// tidy without either fixed widths or per-field configuration, which this
// generic component doesn't have. In table-fixed layout, only the header
// row's cells need the width class — every body cell in a column inherits it.
const STATUS_COLUMN_WIDTH_CLASS = 'w-[190px]';
const DATA_COLUMN_WIDTH_CLASS = 'w-[160px]';
// overflow-hidden text-ellipsis whitespace-nowrap (Tailwind's `truncate`),
// applied to header labels and read-only values so long content shows "…"
// instead of wrapping — combined with a `title` attribute for the full text.
const TRUNCATE_CLASS = 'block truncate';

// Sticky/frozen so the line number and status stay visible while the wide,
// per-field data grid scrolls horizontally underneath — an opaque background
// is required or the scrolled-under columns would show through. z-10 must
// stay below the header row's z-20 (below) so the frozen column scrolls
// *under* the header, not over it.
const STICKY_CELL_CLASS = 'sticky left-0 z-10 bg-background border-r border-border';

// Header row pinned to the top of the scroll container. `!` guards against
// Tailwind's generation-order-dependent cascade when combined with
// STICKY_CELL_CLASS on the corner cell below (both set z-index; without
// `!important` whichever rule happens to compile later would silently win).
const STICKY_HEADER_CLASS = 'sticky top-0 !z-20 bg-background';

// Same success/destructive/neutral tokens as the app's own status-tag--* CSS
// (styles.css, ETP-3835), inlined as Tailwind utilities rather than referencing
// that class: this package's styles.css is consumed via a cross-package @import
// in the host app, which doesn't reliably deliver every rule in that block in
// local-core dev (confirmed via computed style: only the base .status-tag rule
// — padding/radius — reached the page, none of the color variants).
const STATUS_TAG_COLORS = {
  success: 'bg-[#EEFBF4] text-[#17663A]',
  destructive: 'bg-[#FEF0F4] text-[#D50B3E]',
  neutral: 'bg-[#F5F7F9] text-[#3F3F50]',
};

/** Line number + status pill, shared by every row in the frozen leading column. */
function StatusLineTag({ index, tag, children }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs tabular-nums text-muted-foreground" data-testid={`ImportReviewQueue__lineNumber-${index}`}>{index + 1}</span>
      <span
        className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-normal ${STATUS_TAG_COLORS[tag]}`}
        data-testid={`ImportReviewQueue__statusBadge-${index}`}
      >
        {children}
      </span>
    </div>
  );
}

/**
 * A field whose value couldn't be matched to an existing record (FK lookup,
 * e.g. Country). Renders as an obviously-in-error control — clicking it opens
 * a searchable list of the near-matches SimSearch already found (`candidates`,
 * from resolveForeignKeys' classifyCandidates), so fixing it is picking the
 * right record rather than retyping text and hoping "Re-validate" matches.
 * Falls back to accepting the typed text verbatim when nothing matches.
 *
 * When SimSearch found no close candidates at all, opening the popover fetches
 * a much wider, unfiltered browse ("show me every record of this entity")
 * rather than leaving the user staring at an empty list with no way forward.
 * Typing re-queries SimSearch (debounced) for that text so the list re-ranks
 * by live similarity instead of just client-side substring filtering the
 * original candidate set, which misses cross-language/fuzzy matches entirely
 * (e.g. typing "España" would never substring-match "Spain").
 *
 * Selecting a candidate is reported via `onSelect(value, resolvedId)` — a known
 * `resolvedId` means the exact record is already identified (no re-validate
 * round-trip needed), while `null` means the user accepted free-typed text
 * (still needs a fresh SimSearch lookup, same as the old "Re-validate" button).
 */
function FkMismatchCell({ index, field, value, error, onSelect, simSearchFn, token }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [candidates, setCandidates] = useState(error.candidates ?? []);
  const [loading, setLoading] = useState(false);
  const defaultCandidatesRef = useRef(error.candidates ?? []);
  const debounceRef = useRef(null);
  const requestIdRef = useRef(0);

  const handleSelectCandidate = (candidate) => {
    onSelect(candidate.name, candidate.id);
    setOpen(false);
  };

  const handleUseTyped = (text) => {
    onSelect(text, null);
    setOpen(false);
  };

  const fetchCandidates = async (searchText) => {
    if (!simSearchFn || !field.matchEntity) return null;
    const requestId = ++requestIdRef.current;
    setLoading(true);
    try {
      // minSimPercent 0 + a generous qtyResults turns SimSearch's "best matches
      // for this text" into either a live similarity-ranked search (typed text)
      // or an effective "list every record" browse (blank/no-candidates case) —
      // there is no dedicated "list all" endpoint wired into this generic package.
      const [result] = await simSearchFn({ token, entityName: field.matchEntity, items: [searchText], qtyResults: 50, minSimPercent: 0 });
      const found = result?.candidates ?? [];
      if (requestId === requestIdRef.current) setCandidates(found);
      return found;
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  };

  const handleQueryChange = (next) => {
    setQuery(next);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!next.trim()) {
      setCandidates(defaultCandidatesRef.current);
      return;
    }
    debounceRef.current = setTimeout(() => { fetchCandidates(next.trim()); }, 300);
  };

  const handleOpenChange = async (next) => {
    setOpen(next);
    if (!next) {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      return;
    }
    setQuery('');
    const initial = error.candidates ?? [];
    setCandidates(initial);
    defaultCandidatesRef.current = initial;
    if (initial.length > 0) return;
    const browsed = await fetchCandidates(value || '');
    if (browsed) defaultCandidatesRef.current = browsed;
  };

  return (
    <Popover
      open={open}
      onOpenChange={handleOpenChange}
      data-testid={"Popover__" + field.id}>
      <PopoverTrigger asChild data-testid={"PopoverTrigger__" + field.id}>
        <button
          type="button"
          className="flex h-8 w-full items-center justify-between gap-1 rounded-md border border-[#D50B3E]/60 bg-[#FEF0F4] px-2 text-left text-sm text-[#D50B3E]"
          title={error.message}
          data-testid={`ImportReviewQueue__fieldError-${index}-${field.target}`}
        >
          <span className="truncate">{value || '—'}</span>
          <ChevronDown
            className="h-3.5 w-3.5 shrink-0 opacity-70"
            aria-hidden="true"
            data-testid={"ChevronDown__" + field.id} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-64 p-0"
        align="start"
        data-testid={"PopoverContent__" + field.id}>
        <Command shouldFilter={false} data-testid={"Command__" + field.id}>
          <CommandInput
            value={query}
            onValueChange={handleQueryChange}
            placeholder="Search or type a value…"
            data-testid={`ImportReviewQueue__fkSearch-${index}-${field.target}`}
          />
          <CommandList data-testid={"CommandList__" + field.id}>
            {query.trim() && (
              <CommandGroup data-testid={"CommandGroup__" + field.id}>
                <CommandItem
                  value={`__use-typed__${query}`}
                  onSelect={() => handleUseTyped(query.trim())}
                  data-testid={`ImportReviewQueue__fkUseTyped-${index}-${field.target}`}
                >
                  Use &ldquo;{query.trim()}&rdquo;
                </CommandItem>
              </CommandGroup>
            )}
            {loading ? (
              <div className="px-2 py-3 text-center text-xs text-muted-foreground" data-testid={`ImportReviewQueue__fkLoading-${index}-${field.target}`}>
                Searching…
              </div>
            ) : candidates.length === 0 ? (
              <CommandEmpty data-testid={"CommandEmpty__" + field.id}>{query.trim() ? null : 'No matches found — type a value above.'}</CommandEmpty>
            ) : (
              <CommandGroup data-testid={"CommandGroup__" + field.id}>
                {candidates.map((c) => (
                  <CommandItem
                    key={c.id}
                    value={c.name}
                    onSelect={() => handleSelectCandidate(c)}
                    data-testid={`ImportReviewQueue__fkCandidate-${index}-${field.target}-${c.id}`}
                  >
                    <span className="flex-1 truncate">{c.name}</span>
                    {c.similarityPercent != null && (
                      <span className="text-xs text-muted-foreground">{Math.round(c.similarityPercent)}%</span>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/**
 * Builds a CSV of every currently-erroring or skipped entry, one row per
 * entry (not per field) — columns are the ORIGINAL uploaded file's mapped
 * headers (so a fixed copy can be re-uploaded through the same mapping),
 * plus a trailing Error column combining every message for that row.
 * Unmapped headers are omitted — they were never part of the import target
 * set. Additive to the queue, never a replacement for it (the mock's
 * "download once, never revisit" behavior was explicitly NOT adopted; see
 * the design spec's UI divergences).
 */
export function buildErrorsCsv(entries, headers, mapping) {
  const mappedHeaders = headers.filter((h) => mapping[h]);
  const lines = [[...mappedHeaders, 'Error'].map(csvField).join(',')];
  for (const entry of entries) {
    if (entry.errors.length === 0) continue;
    const values = mappedHeaders.map((h) => entry.row[mapping[h]]);
    const errorText = entry.errors.map((e) => (e.target ? `${e.target}: ${e.message}` : e.message)).join(' | ');
    lines.push([...values, errorText].map(csvField).join(','));
  }
  return lines.join('\n');
}

export function ImportReviewQueue({
  entries,
  fields = [],
  statusFilter = 'all',
  onStatusFilterChange,
  onEditField,
  onRetryEntry,
  onSkipEntry,
  onUnskipEntry,
  onApplyFkValue,
  onDownloadErrors,
  retryLabel = 'Retry',
  showRetry = true,
  labels,
  simSearchFn,
  token,
}) {
  const text = { ...DEFAULT_LABELS, ...labels };
  // Which row/field's input currently has focus, if any — `{ index, target }` or null.
  // Editing a cell re-validates its whole entry immediately (see ImportDialog's
  // handleEditField), so the very first keystroke that fixes a row's last error can, in
  // the same render, (a) drop it out of the "Errors" filter tab and (b) flip its row from
  // the editable error branch to the read-only OK branch below — either one alone
  // unmounts the input and steals focus from under the user's cursor mid-keystroke
  // (reproduced live: typing one character into an error cell under the "Errors" tab
  // silently dropped focus with no visible destination). Both `visibleEntries` and the OK
  // vs. error branch choice below exempt the focused row until it blurs.
  const [focusedCell, setFocusedCell] = useState(null);
  const visibleEntries = entries
    .map((entry, index) => ({ entry, index }))
    .filter(({ entry, index }) => {
      if (statusFilter === 'all') return true;
      if (focusedCell?.index === index) return true;
      const isAttentionNeeded = entry.status === 'skipped' || entry.errors.length > 0;
      return statusFilter === 'error' ? isAttentionNeeded : !isAttentionNeeded;
    });

  const counts = {
    all: entries.length,
    ok: entries.filter((e) => e.status !== 'skipped' && e.errors.length === 0).length,
    error: entries.filter((e) => e.status === 'skipped' || e.errors.length > 0).length,
  };

  // Awaiting the user's yes/no on whether a just-picked FK fix should also apply to every
  // other row currently failing on the same raw value (e.g. every "Brazil" row, not just
  // this one) — null when no prompt is showing.
  const [pendingBulkApply, setPendingBulkApply] = useState(null);

  // One DOM node per (row index, field target) rendered in the error branch —
  // populated via a callback ref on each error-row TableCell, read back by
  // handleJumpToFirstError to scrollIntoView the first (in column order, not
  // entry.errors order) cell that actually has a field-level error.
  const cellRefs = useRef(new Map());

  const registerCellRef = (index, target) => (el) => {
    const key = `${index}:${target}`;
    if (el) cellRefs.current.set(key, el);
    else cellRefs.current.delete(key);
  };

  const handleJumpToFirstError = (index, rowColumns, entry) => {
    const firstErrorField = rowColumns.find((field) => entry.errors.some((e) => e.target === field.target));
    if (!firstErrorField) return;
    const cell = cellRefs.current.get(`${index}:${firstErrorField.target}`);
    cell?.scrollIntoView({ inline: 'nearest', block: 'nearest' });
  };

  /** Other non-skipped rows whose `field` is failing on the exact same raw value. */
  const findMatchingIndices = (index, field, rawValue) => {
    const trimmed = String(rawValue ?? '').trim();
    if (!trimmed) return [];
    return entries.reduce((acc, entry, i) => {
      if (i === index || entry.status === 'skipped') return acc;
      const sameMismatch = entry.errors.some(
        (err) => err.target === field.target && err.candidates !== undefined
          && String(entry.row[field.target] ?? '').trim() === trimmed,
      );
      if (sameMismatch) acc.push(i);
      return acc;
    }, []);
  };

  const handleFkValueSelected = (index, field, value, resolvedId) => {
    const rawValue = entries[index].row[field.target];
    const matchingIndices = findMatchingIndices(index, field, rawValue);
    if (matchingIndices.length > 0) {
      setPendingBulkApply({ index, field, value, resolvedId, matchingIndices, rawValue });
    } else {
      onApplyFkValue({ indices: [index], field, value, resolvedId });
    }
  };

  const resolvePendingBulkApply = (applyToAll) => {
    const { index, field, value, resolvedId, matchingIndices } = pendingBulkApply;
    onApplyFkValue({ indices: applyToAll ? [index, ...matchingIndices] : [index], field, value, resolvedId });
    setPendingBulkApply(null);
  };

  // When the caller declares the import's fields, the preview renders one real
  // table column per field (a proper data grid) instead of collapsing the whole
  // row into a single cell. Without declared fields (isolated/legacy usage) we
  // fall back to a single "Row" column.
  const dataColumns = fields.length > 0 ? fields : null;
  const dataColumnCount = dataColumns ? dataColumns.length : 1;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex shrink-0 items-center justify-between">
        <div className="flex items-center gap-1" role="group" aria-label={text.status}>
          {STATUS_FILTERS.map((opt) => (
            <Button
              key={opt.value}
              type="button"
              size="sm"
              variant={statusFilter === opt.value ? 'default' : 'ghost'}
              onClick={() => onStatusFilterChange(opt.value)}
              data-testid={`ImportReviewQueue__statusFilter-${opt.value}`}
            >
              {text[opt.labelKey]}
              <span
                className="ml-1.5 rounded-full bg-black/10 px-1.5 py-0.5 text-[10px] tabular-nums"
                data-testid={`ImportReviewQueue__statusFilterCount-${opt.value}`}
              >
                {counts[opt.value]}
              </span>
            </Button>
          ))}
        </div>
        <Button type="button" variant="secondary" size="sm" onClick={onDownloadErrors} data-testid="ImportReviewQueue__download">
          {text.downloadErrors}
        </Button>
      </div>
      <ScrollPane data-testid="ScrollPane__a73779">
      {/* Table.jsx's own wrapper div has an independent, unbounded-height
          overflow-auto — its horizontal scrollbar would render at the very
          bottom of the FULL (unclipped) content instead of the visible
          viewport (invisible until scrolling all the way down). Neutralizing
          it hands both scroll axes to this ScrollPane, so both scrollbars sit
          at the actual visible edges. Same idiom as DataTable.jsx's
          `[&>div]:!overflow-visible`. */}
      <div className="[&>div]:!overflow-visible">
      <Table className="table-fixed" data-testid="Table__a73779">
        <TableHeader className={STICKY_HEADER_CLASS} data-testid="TableHeader__a73779">
          <TableRow data-testid="TableRow__a73779">
            <TableHead
              className={`${STATUS_COLUMN_WIDTH_CLASS} ${STICKY_CELL_CLASS}`}
              data-testid="TableHead__a73779">{text.status}</TableHead>
            {dataColumns
              ? dataColumns.map((field) => (
                <TableHead key={field.target} className={DATA_COLUMN_WIDTH_CLASS} data-testid={"TableHead__" + field.id}>
                  <span className={TRUNCATE_CLASS} title={field.label ?? field.target}>{field.label ?? field.target}</span>
                </TableHead>
              ))
              : <TableHead data-testid="TableHead__a73779">Row</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody data-testid="TableBody__a73779">
          {visibleEntries.map(({ entry, index }) => {
            const isSkipped = entry.status === 'skipped';

            if (isSkipped) {
              return (
                <TableRow key={index} data-testid="TableRow__a73779">
                  <TableCell className={STICKY_CELL_CLASS} data-testid="TableCell__a73779">
                    <div className="flex items-center gap-2">
                      <StatusLineTag index={index} tag="neutral" data-testid="StatusLineTag__a73779">{text.skipped}</StatusLineTag>
                      {onUnskipEntry && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => onUnskipEntry(index)}
                          data-testid={`ImportReviewQueue__unskip-${index}`}
                          title={text.unskip}
                        >
                          <Check className="h-3 w-3" aria-hidden="true" data-testid="Check__a73779" />
                          <span className="sr-only">{text.unskip}</span>
                        </Button>
                      )}
                    </div>
                  </TableCell>
                  <TableCell colSpan={dataColumnCount} data-testid="TableCell__a73779">
                    <span className="text-xs text-muted-foreground" data-testid={`ImportReviewQueue__skippedLabel-${index}`}>{text.skipped}</span>
                  </TableCell>
                </TableRow>
              );
            }

            if (entry.errors.length === 0 && focusedCell?.index !== index) {
              return (
                <TableRow key={index} data-testid="TableRow__a73779">
                  <TableCell className={STICKY_CELL_CLASS} data-testid="TableCell__a73779">
                    <div className="flex items-center gap-2">
                      <StatusLineTag index={index} tag="success" data-testid="StatusLineTag__a73779">{text.statusOk}</StatusLineTag>
                      <div className="flex items-center gap-0.5">
                        {showRetry && (
                          <Button
                            type="button"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => onRetryEntry(index)}
                            data-testid={`ImportReviewQueue__retry-${index}`}
                            title={retryLabel}
                          >
                            <RotateCw className="h-3 w-3" aria-hidden="true" data-testid="RotateCw__a73779" />
                            <span className="sr-only">{retryLabel}</span>
                          </Button>
                        )}
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          data-testid={`ImportReviewQueue__skip-${index}`}
                          onClick={() => onSkipEntry(index)}
                          title={text.skip}
                        >
                          <Ban className="h-3 w-3" aria-hidden="true" data-testid="Ban__a73779" />
                          <span className="sr-only">{text.skip}</span>
                        </Button>
                      </div>
                    </div>
                  </TableCell>
                  {dataColumns ? (
                    dataColumns.map((field) => (
                      <TableCell key={field.target} data-testid={"TableCell__" + field.id}>
                        <span
                          className={TRUNCATE_CLASS}
                          title={entry.row[field.target] ?? ''}
                          data-testid={`ImportReviewQueue__value-${index}-${field.target}`}
                        >
                          {entry.row[field.target] ?? ''}
                        </span>
                      </TableCell>
                    ))
                  ) : (
                    <TableCell colSpan={dataColumnCount} data-testid="TableCell__a73779">
                      <span
                        className={TRUNCATE_CLASS}
                        title={Object.values(entry.row).join(' · ')}
                        data-testid={`ImportReviewQueue__summary-${index}`}
                      >
                        {Object.values(entry.row).join(' · ')}
                      </span>
                    </TableCell>
                  )}
                </TableRow>
              );
            }

            // A blank error.target means BatchService rejected the whole operation, not
            // one field — there is no single cell to flag, so every mapped field becomes
            // editable rather than showing one useless blank-labeled input.
            const rowLevelError = entry.errors.find((e) => !e.target);
            const rowColumns = dataColumns ?? entry.errors.map((e) => ({ target: e.target, label: e.target }));

            const fieldErrorLabels = entry.errors
              .filter((e) => e.target)
              .map((e) => rowColumns.find((f) => f.target === e.target)?.label ?? e.target);
            const errorTooltip = fieldErrorLabels.length > 0
              ? formatTemplate(text.fieldErrorsTooltip, { fields: fieldErrorLabels.join(', ') })
              : undefined;

            return (
              <TableRow key={index} data-testid="TableRow__a73779">
                <TableCell
                  className={`${STICKY_CELL_CLASS} align-top`}
                  data-testid="TableCell__a73779">
                  <div className="flex min-w-[160px] flex-col gap-1 py-1">
                    <div className="flex items-center gap-2">
                      <StatusLineTag index={index} tag="destructive" data-testid="StatusLineTag__a73779">
                        {fieldErrorLabels.length > 0 ? (
                          <button
                            type="button"
                            className="inline-flex cursor-pointer items-center"
                            onClick={() => handleJumpToFirstError(index, rowColumns, entry)}
                            data-testid={`ImportReviewQueue__jumpToFirstError-${index}`}
                          >
                            <AlertCircle
                              className="h-3.5 w-3.5"
                              aria-hidden="true"
                              title={errorTooltip}
                              data-testid="AlertCircle__a73779" />
                          </button>
                        ) : (
                          <AlertCircle
                            className="h-3.5 w-3.5"
                            aria-hidden="true"
                            data-testid="AlertCircle__a73779" />
                        )}
                        <span className="sr-only">{text.statusError}</span>
                      </StatusLineTag>
                      <div className="flex items-center gap-0.5">
                        {showRetry && (
                          <Button
                            type="button"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => onRetryEntry(index)}
                            data-testid={`ImportReviewQueue__retry-${index}`}
                            title={retryLabel}
                          >
                            <RotateCw className="h-3 w-3" aria-hidden="true" data-testid="RotateCw__a73779" />
                            <span className="sr-only">{retryLabel}</span>
                          </Button>
                        )}
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          data-testid={`ImportReviewQueue__skip-${index}`}
                          onClick={() => onSkipEntry(index)}
                          title={text.skip}
                        >
                          <Ban className="h-3 w-3" aria-hidden="true" data-testid="Ban__a73779" />
                          <span className="sr-only">{text.skip}</span>
                        </Button>
                      </div>
                    </div>
                    {rowLevelError && (
                      <span
                        className="text-xs text-destructive"
                        data-testid={`ImportReviewQueue__rowError-${index}`}
                      >
                        {rowLevelError.message}
                      </span>
                    )}
                  </div>
                </TableCell>
                {rowColumns.map((field) => {
                  const fieldError = entry.errors.find((e) => e.target === field.target);
                  const isFocusedCell = focusedCell?.index === index && focusedCell?.target === field.target;
                  const isEditable = Boolean(rowLevelError || fieldError || isFocusedCell);
                  // Only the FK-lookup validator attaches `candidates` (possibly empty) —
                  // that's the signal this is a "pick the right record" error rather than
                  // a plain required/format error that just needs retyping.
                  const isFkMismatch = fieldError && !rowLevelError && fieldError.candidates !== undefined;
                  return (
                    <TableCell key={field.target} ref={registerCellRef(index, field.target)} data-testid={"TableCell__" + field.id}>
                      {isFkMismatch ? (
                        <FkMismatchCell
                          index={index}
                          field={field}
                          value={entry.row[field.target] ?? ''}
                          error={fieldError}
                          onSelect={(value, resolvedId) => handleFkValueSelected(index, field, value, resolvedId)}
                          simSearchFn={simSearchFn}
                          token={token}
                          data-testid={"FkMismatchCell__" + field.id} />
                      ) : isEditable ? (
                        <div className="flex flex-col gap-1">
                          {fieldError && !rowLevelError && (
                            <span
                              className="truncate text-xs text-destructive"
                              title={fieldError.message}
                              data-testid={`ImportReviewQueue__fieldError-${index}-${field.target}`}
                            >
                              {fieldError.message}
                            </span>
                          )}
                          <Input
                            value={entry.row[field.target] ?? ''}
                            onChange={(e) => onEditField(index, field.target, e.target.value)}
                            onFocus={() => setFocusedCell({ index, target: field.target })}
                            onBlur={() => setFocusedCell((prev) => (
                              prev?.index === index && prev?.target === field.target ? null : prev
                            ))}
                            className="h-8"
                            data-testid={`ImportReviewQueue__input-${index}-${field.target}`}
                          />
                        </div>
                      ) : (
                        <span
                          className={TRUNCATE_CLASS}
                          title={entry.row[field.target] ?? ''}
                          data-testid={`ImportReviewQueue__value-${index}-${field.target}`}
                        >
                          {entry.row[field.target] ?? ''}
                        </span>
                      )}
                    </TableCell>
                  );
                })}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      </div>
      </ScrollPane>
      {pendingBulkApply && (
        <Dialog
          open
          onOpenChange={(next) => { if (!next) setPendingBulkApply(null); }}
          data-testid="Dialog__bulkApplyFk">
          <DialogContent data-testid="DialogContent__bulkApplyFk">
            <DialogHeader data-testid="DialogHeader__bulkApplyFk">
              <DialogTitle data-testid="DialogTitle__bulkApplyFk">{text.bulkApplyTitle}</DialogTitle>
              <DialogDescription data-testid="DialogDescription__bulkApplyFk">
                {formatTemplate(text.bulkApplyDescription, {
                  count: pendingBulkApply.matchingIndices.length,
                  raw: pendingBulkApply.rawValue,
                  value: pendingBulkApply.value,
                })}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter data-testid="DialogFooter__bulkApplyFk">
              <Button
                type="button"
                variant="outline"
                onClick={() => resolvePendingBulkApply(false)}
                data-testid="ImportReviewQueue__bulkApplyOnlyThis"
              >
                {text.bulkApplyOnlyThis}
              </Button>
              <Button
                type="button"
                onClick={() => resolvePendingBulkApply(true)}
                data-testid="ImportReviewQueue__bulkApplyAll"
              >
                {text.bulkApplyAll}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

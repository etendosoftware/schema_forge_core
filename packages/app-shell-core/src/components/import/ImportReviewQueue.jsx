import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { RotateCw, Copy, SkipForward, AlertCircle, ChevronDown, Pencil } from 'lucide-react';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../ui/table.jsx';
import { Input } from '../ui/input.jsx';
import { Button } from '../ui/button.jsx';
import { Popover, PopoverTrigger, PopoverContent } from '../ui/popover.jsx';
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from '../ui/command.jsx';

const DEFAULT_LABELS = {
  showOnlyErrors: 'Show only errors',
  showAll: 'Show all',
  skip: 'Skip',
  skipped: 'Skipped',
  unskip: 'Edit again',
  downloadErrors: 'Download errors',
  copyError: 'Copy error',
  copied: 'Copied to clipboard',
  copyFailed: 'Could not copy to clipboard',
  status: 'Status',
  statusOk: 'OK',
  statusError: 'Error',
};

// Sticky/frozen so the line number and status stay visible while the wide,
// per-field data grid scrolls horizontally underneath — an opaque background
// is required or the scrolled-under columns would show through.
const STICKY_CELL_CLASS = 'sticky left-0 z-10 bg-background border-r border-border';

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

/**
 * Plain-text summary of one entry's errors, e.g. for pasting into a support
 * ticket. These are frequently raw, uncontrolled server messages (BatchService's
 * own generic "Operation 'x' rejected by server" wrapper, or a raw unhandled
 * exception) rather than a friendly validation message — the user can't fix
 * those themselves, only retry or hand the exact text to support.
 */
function errorsToText(entry) {
  return entry.errors.map((e) => (e.target ? `${e.target}: ${e.message}` : e.message)).join('\n');
}

function csvEscape(value) {
  const s = String(value ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

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
 */
function FkMismatchCell({ index, field, value, error, onEditField, simSearchFn, token }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [candidates, setCandidates] = useState(error.candidates ?? []);
  const [loading, setLoading] = useState(false);
  const defaultCandidatesRef = useRef(error.candidates ?? []);
  const debounceRef = useRef(null);
  const requestIdRef = useRef(0);

  const handleSelect = (name) => {
    onEditField(index, field.target, name);
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
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex h-8 w-full items-center justify-between gap-1 rounded-md border border-[#D50B3E]/60 bg-[#FEF0F4] px-2 text-left text-sm text-[#D50B3E]"
          title={error.message}
          data-testid={`ImportReviewQueue__fieldError-${index}-${field.target}`}
        >
          <span className="truncate">{value || '—'}</span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            value={query}
            onValueChange={handleQueryChange}
            placeholder="Search or type a value…"
            data-testid={`ImportReviewQueue__fkSearch-${index}-${field.target}`}
          />
          <CommandList>
            {query.trim() && (
              <CommandGroup>
                <CommandItem
                  value={`__use-typed__${query}`}
                  onSelect={() => handleSelect(query.trim())}
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
              <CommandEmpty>{query.trim() ? null : 'No matches found — type a value above.'}</CommandEmpty>
            ) : (
              <CommandGroup>
                {candidates.map((c) => (
                  <CommandItem
                    key={c.id}
                    value={c.name}
                    onSelect={() => handleSelect(c.name)}
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
 * (entry, flagged field) pair — additive to the queue, never a replacement
 * for it (the mock's "download once, never revisit" behavior was explicitly
 * NOT adopted; see the design spec's UI divergences).
 */
export function buildErrorsCsv(entries) {
  const lines = ['target,value,reason'];
  for (const entry of entries) {
    for (const error of entry.errors) {
      lines.push([error.target, entry.row[error.target], error.message].map(csvEscape).join(','));
    }
  }
  return lines.join('\n');
}

export function ImportReviewQueue({
  entries,
  fields = [],
  showOnlyErrors,
  onToggleFilter,
  onEditField,
  onRetryEntry,
  onSkipEntry,
  onUnskipEntry,
  onDownloadErrors,
  retryLabel = 'Retry',
  labels,
  simSearchFn,
  token,
}) {
  const text = { ...DEFAULT_LABELS, ...labels };
  const visibleEntries = entries
    .map((entry, index) => ({ entry, index }))
    .filter(({ entry }) => !showOnlyErrors || entry.errors.length > 0 || entry.status === 'skipped');

  const handleCopyError = async (entry) => {
    try {
      await navigator.clipboard.writeText(errorsToText(entry));
      toast.success(text.copied);
    } catch {
      toast.error(text.copyFailed);
    }
  };

  // When the caller declares the import's fields, the preview renders one real
  // table column per field (a proper data grid) instead of collapsing the whole
  // row into a single cell. Without declared fields (isolated/legacy usage) we
  // fall back to a single "Row" column.
  const dataColumns = fields.length > 0 ? fields : null;
  const dataColumnCount = dataColumns ? dataColumns.length : 1;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <button
          type="button"
          className="text-xs text-primary underline"
          onClick={onToggleFilter}
          data-testid="ImportReviewQueue__filterToggle"
        >
          {showOnlyErrors ? text.showAll : text.showOnlyErrors}
        </button>
        <Button type="button" variant="secondary" size="sm" onClick={onDownloadErrors} data-testid="ImportReviewQueue__download">
          {text.downloadErrors}
        </Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className={`w-[1%] whitespace-nowrap ${STICKY_CELL_CLASS}`}>{text.status}</TableHead>
            {dataColumns
              ? dataColumns.map((field) => <TableHead key={field.target}>{field.label ?? field.target}</TableHead>)
              : <TableHead>Row</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {visibleEntries.map(({ entry, index }) => {
            const isSkipped = entry.status === 'skipped';

            if (isSkipped) {
              return (
                <TableRow key={index}>
                  <TableCell className={STICKY_CELL_CLASS}>
                    <div className="flex items-center gap-2">
                      <StatusLineTag index={index} tag="neutral">{text.skipped}</StatusLineTag>
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
                          <Pencil className="h-3 w-3" aria-hidden="true" />
                          <span className="sr-only">{text.unskip}</span>
                        </Button>
                      )}
                    </div>
                  </TableCell>
                  <TableCell colSpan={dataColumnCount}>
                    <span className="text-xs text-muted-foreground" data-testid={`ImportReviewQueue__skippedLabel-${index}`}>{text.skipped}</span>
                  </TableCell>
                </TableRow>
              );
            }

            if (entry.errors.length === 0) {
              return (
                <TableRow key={index}>
                  <TableCell className={STICKY_CELL_CLASS}>
                    <div className="flex items-center gap-2">
                      <StatusLineTag index={index} tag="success">{text.statusOk}</StatusLineTag>
                      <div className="flex items-center gap-0.5">
                        <Button
                          type="button"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => onRetryEntry(index)}
                          data-testid={`ImportReviewQueue__retry-${index}`}
                          title={retryLabel}
                        >
                          <RotateCw className="h-3 w-3" aria-hidden="true" />
                          <span className="sr-only">{retryLabel}</span>
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          data-testid={`ImportReviewQueue__skip-${index}`}
                          onClick={() => onSkipEntry(index)}
                          title={text.skip}
                        >
                          <SkipForward className="h-3 w-3" aria-hidden="true" />
                          <span className="sr-only">{text.skip}</span>
                        </Button>
                      </div>
                    </div>
                  </TableCell>
                  {dataColumns ? (
                    dataColumns.map((field) => (
                      <TableCell key={field.target}>
                        <span data-testid={`ImportReviewQueue__value-${index}-${field.target}`}>{entry.row[field.target] ?? ''}</span>
                      </TableCell>
                    ))
                  ) : (
                    <TableCell colSpan={dataColumnCount}>
                      <span data-testid={`ImportReviewQueue__summary-${index}`}>{Object.values(entry.row).join(' · ')}</span>
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

            return (
              <TableRow key={index}>
                <TableCell className={`${STICKY_CELL_CLASS} align-top`}>
                  <div className="flex min-w-[160px] flex-col gap-1 py-1">
                    <div className="flex items-center gap-2">
                      <StatusLineTag index={index} tag="destructive">
                        <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
                        <span className="sr-only">{text.statusError}</span>
                      </StatusLineTag>
                      <div className="flex items-center gap-0.5">
                        <Button
                          type="button"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => onRetryEntry(index)}
                          data-testid={`ImportReviewQueue__retry-${index}`}
                          title={retryLabel}
                        >
                          <RotateCw className="h-3 w-3" aria-hidden="true" />
                          <span className="sr-only">{retryLabel}</span>
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          size="icon"
                          className="h-6 w-6"
                          data-testid={`ImportReviewQueue__copy-${index}`}
                          onClick={() => handleCopyError(entry)}
                          title={text.copyError}
                        >
                          <Copy className="h-3 w-3" aria-hidden="true" />
                          <span className="sr-only">{text.copyError}</span>
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          data-testid={`ImportReviewQueue__skip-${index}`}
                          onClick={() => onSkipEntry(index)}
                          title={text.skip}
                        >
                          <SkipForward className="h-3 w-3" aria-hidden="true" />
                          <span className="sr-only">{text.skip}</span>
                        </Button>
                      </div>
                    </div>
                    {rowLevelError && (
                      <span
                        className="line-clamp-2 text-xs text-destructive"
                        title={rowLevelError.message}
                        data-testid={`ImportReviewQueue__rowError-${index}`}
                      >
                        {rowLevelError.message}
                      </span>
                    )}
                  </div>
                </TableCell>
                {rowColumns.map((field) => {
                  const fieldError = entry.errors.find((e) => e.target === field.target);
                  const isEditable = Boolean(rowLevelError || fieldError);
                  // Only the FK-lookup validator attaches `candidates` (possibly empty) —
                  // that's the signal this is a "pick the right record" error rather than
                  // a plain required/format error that just needs retyping.
                  const isFkMismatch = fieldError && !rowLevelError && fieldError.candidates !== undefined;
                  return (
                    <TableCell key={field.target}>
                      {isFkMismatch ? (
                        <FkMismatchCell
                          index={index}
                          field={field}
                          value={entry.row[field.target] ?? ''}
                          error={fieldError}
                          onEditField={onEditField}
                          simSearchFn={simSearchFn}
                          token={token}
                        />
                      ) : isEditable ? (
                        <div className="flex flex-col gap-1">
                          {fieldError && !rowLevelError && (
                            <span
                              className="line-clamp-2 text-xs text-destructive"
                              title={fieldError.message}
                              data-testid={`ImportReviewQueue__fieldError-${index}-${field.target}`}
                            >
                              {fieldError.message}
                            </span>
                          )}
                          <Input
                            value={entry.row[field.target] ?? ''}
                            onChange={(e) => onEditField(index, field.target, e.target.value)}
                            className="h-8"
                            data-testid={`ImportReviewQueue__input-${index}-${field.target}`}
                          />
                        </div>
                      ) : (
                        <span data-testid={`ImportReviewQueue__value-${index}-${field.target}`}>{entry.row[field.target] ?? ''}</span>
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
  );
}

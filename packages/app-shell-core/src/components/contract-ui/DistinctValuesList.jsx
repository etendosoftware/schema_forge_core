import { useEffect, useRef } from 'react';
import { Check, Loader2 } from 'lucide-react';

/**
 * Shared dropdown list used by filters that pick one value out of the set of
 * distinct values for a field (status selector, advanced-filter value picker).
 *
 * Renders:
 *   - A search input wired to `distinct.search` / `distinct.setSearch`.
 *   - An optional "all / any" row (when `allLabel` is non-null) that calls
 *     `onSelect(null)` — callers treat null as "clear this filter".
 *   - One row per merged code; active row gets a check mark. Pass `activeCodes`
 *     (an array) instead of `activeCode` for multi-select: every listed code is
 *     ticked and `onSelect` is expected to toggle rather than replace.
 *   - Optional, all opt-in (ETP-5591): `heading` (small caption above the list),
 *     `searchable={false}` (hide the search box for short fixed lists),
 *     `renderLabel(code)` (a node — e.g. a status Tag — rendered INSTEAD of the
 *     `labelFor` text; `labelFor` must stay a string because callers search on
 *     it), and `indicator="checkbox"` (a checkbox box instead of the check mark,
 *     the multi-select look; rows then expose `role="checkbox"` + `aria-checked`).
 *   - A centred spinner while the list is empty and loading. `loading`
 *     overrides `distinct.loading` for that decision — a caller that withholds
 *     its codes until the first page settles (ETP-5009) passes it so the
 *     spinner also covers the render before the fetch has flipped `loading`.
 *   - An IntersectionObserver sentinel that invokes `distinct.loadMore()` as
 *     the user scrolls near the bottom, so the dropdown behaves like an
 *     infinite list instead of a single large page.
 *
 * Merge policy between in-memory codes and backend pagination lives in the
 * parent; this component just renders what it's given.
 */
export function DistinctValuesList({
  activeCode,
  activeCodes = null,
  allLabel,
  codes,
  labelFor,
  distinct,
  onSelect,
  searchPlaceholder,
  emptyLabel = null,
  heading = null,
  searchable = true,
  renderLabel = null,
  indicator = 'check',
  loading = null,
}) {
  const isLoading = loading ?? distinct.loading;
  const sentinelRef = useRef(null);
  // Multi-select mode is opt-in via `activeCodes`; single-select consumers keep
  // passing `activeCode` and behave exactly as before.
  const selected = activeCodes ? new Set(activeCodes.map(String)) : null;
  const isActive = (code) => (selected ? selected.has(String(code)) : activeCode === code);
  const hasSelection = selected ? selected.size > 0 : !!activeCode;

  const asCheckbox = indicator === 'checkbox';
  const rowA11y = (active) => (asCheckbox ? { role: 'checkbox', 'aria-checked': active } : {});
  const renderIndicator = (active) => (asCheckbox
    ? <CheckboxBox checked={active} data-testid="CheckboxBox__55c679" />
    : (
      <span className="w-4 shrink-0">
        {active && <Check className="h-3.5 w-3.5" data-testid="Check__55c679" />}
      </span>
    ));

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !distinct.hasMore || distinct.loadingMore) return undefined;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) distinct.loadMore();
    }, { root: node.parentElement, rootMargin: '32px' });
    observer.observe(node);
    return () => observer.disconnect();
  }, [distinct.hasMore, distinct.loadingMore, distinct.loadMore, distinct.values.length]);

  return (
    <div className="flex flex-col">
      {heading && (
        <div className="px-3 pt-2 pb-1 text-xs font-medium text-muted-foreground">{heading}</div>
      )}
      {searchable && (
        <div className="p-2 border-b border-border">
          <input
            type="text"
            value={distinct.search}
            onChange={(e) => distinct.setSearch(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full h-8 px-2 text-sm rounded-md border border-border bg-card focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
      )}
      <div className="max-h-72 overflow-auto py-1">
        {allLabel && (
          <button
            type="button"
            onClick={() => onSelect(null)}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left hover:bg-muted/50 transition-colors"
            {...rowA11y(!hasSelection)}
          >
            {renderIndicator(!hasSelection)}
            <span className="flex-1 truncate">{allLabel}</span>
          </button>
        )}
        {codes.map((code) => (
          <button
            key={code}
            type="button"
            onClick={() => onSelect(code)}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left hover:bg-muted/50 transition-colors"
            {...rowA11y(isActive(code))}
          >
            {renderIndicator(isActive(code))}
            <span className="flex-1 min-w-0 truncate">{renderLabel ? renderLabel(code) : labelFor(code)}</span>
          </button>
        ))}
        {isLoading && codes.length === 0 && (
          <div className="flex items-center justify-center py-4 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" data-testid="Loader2__55c679" />
          </div>
        )}
        {/* An empty list must SAY it is empty (ETP-5119). The picker used to
            paper over "no match" by dumping every declared code back in; now
            that it correctly renders nothing, a bare "—" reads as a broken
            dropdown. `emptyLabel` is the translated "No results" from the
            caller — the fallback keeps older callers rendering as before. */}
        {!isLoading && codes.length === 0 && (
          <div className="px-3 py-3 text-sm text-muted-foreground text-center">
            {distinct.search ? (emptyLabel || '—') : ''}
          </div>
        )}
        {distinct.hasMore && (
          <div ref={sentinelRef} className="flex items-center justify-center py-2">
            {distinct.loadingMore && (
              <Loader2
                className="h-4 w-4 animate-spin text-muted-foreground"
                data-testid="Loader2__55c679" />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Visual-only checkbox box (same look as `ui/checkbox.jsx`). The real
 * `Checkbox` renders a `<label>` + `<input>`, which is invalid inside the row
 * `<button>`; the row itself carries `role="checkbox"` / `aria-checked`.
 */
function CheckboxBox({ checked }) {
  return (
    <span
      aria-hidden="true"
      className={`w-4 h-4 shrink-0 rounded border-[1.5px] flex items-center justify-center transition-colors ${
        checked ? 'bg-primary border-primary' : 'bg-card border-border-control'
      }`}
    >
      {checked && (
        <svg width="8" height="6" viewBox="-0.5 -0.5 8 6" fill="none">
          <path
            d="M0.5 2.5 L2.5 4.5 L6.5 0.5"
            stroke="white"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </span>
  );
}

export default DistinctValuesList;

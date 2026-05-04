import { useState, useEffect, useRef } from 'react';
import { useUI } from '@/i18n';
import { computeDocumentTotals } from '@/lib/documentTotals';

/**
 * DocumentTotalsPanel — generic totals block for document detail views.
 *
 * Default (collapsed) state: shows Subtotal / Tax / Total rows + a "+ Add discount"
 * text link below.
 *
 * Expanded state (after clicking "+ Add discount" or when lines load from the server
 * with a non-zero discount): shows a breakdown with a "Discount per product" checkbox.
 * When the checkbox is enabled the discount column becomes visible in the lines
 * grid; when disabled it is hidden. The discount amount row shows a negative value
 * when discountPerProductEnabled is true and the computed discount is positive.
 *
 * All totals are computed client-side from `lines` + optional `pendingLine`
 * so they update in real-time as the user types in the inline add-row — without
 * waiting for the server to save the new line.
 *
 * Props:
 *   lines                     — array of line row objects (hook.children)
 *   pendingLine               — optional: in-progress add-row values (live snapshot)
 *   lineConfig                — { qtyField, priceField, discountField, grossField }
 *   formatAmount              — function(amount, currency?) → formatted string
 *   currency                  — currency identifier string (e.g. 'USD', 'EUR')
 *   discountPerProductEnabled — boolean (controlled from parent)
 *   onDiscountPerProductChange — function(boolean) — called when checkbox changes
 *   readOnly                  — boolean — when true hides the "+ Add discount" toggle
 */
export default function DocumentTotalsPanel({
  lines = [],
  pendingLine = null,
  editingLine = null,
  lineConfig,
  formatAmount,
  currency,
  discountPerProductEnabled = false,
  onDiscountPerProductChange,
  readOnly = false,
}) {
  const ui = useUI();
  const [discountPanelOpen, setDiscountPanelOpen] = useState(false);

  // Auto-expand once when lines first arrive from the server with a non-zero discount.
  // A ref guard ensures this fires only once per document: the guard resets whenever
  // lines goes back to empty (document navigation clears lines before loading new ones).
  const hasAutoExpandedRef = useRef(false);
  useEffect(() => {
    if (lines.length === 0) {
      hasAutoExpandedRef.current = false;
      return;
    }
    if (hasAutoExpandedRef.current || !lineConfig?.discountField) return;
    hasAutoExpandedRef.current = true;
    const hasDiscount = lines.some(l => parseFloat(l[lineConfig.discountField] ?? 0) > 0);
    if (hasDiscount) {
      setDiscountPanelOpen(true);
      onDiscountPerProductChange?.(true);
    }
  }, [lines.length, lineConfig?.discountField]); // eslint-disable-line react-hooks/exhaustive-deps

  // Collapse the panel only when the parent resets discountPerProductEnabled to false AND there are
  // no lines left. This distinguishes document navigation (all lines gone) from the user manually
  // unchecking the checkbox — in the latter case the panel stays expanded, only the checkbox changes.
  const prevDiscountEnabled = useRef(discountPerProductEnabled);
  useEffect(() => {
    if (prevDiscountEnabled.current && !discountPerProductEnabled && lines.length === 0) {
      setDiscountPanelOpen(false);
    }
    prevDiscountEnabled.current = discountPerProductEnabled;
  }, [discountPerProductEnabled, lines.length]);

  // --- Computations (client-side, real-time) ---

  const { grossSubtotal, netSubtotal, grandTotal, discountAmt, taxAmt } =
    computeDocumentTotals(lines, pendingLine, editingLine, lineConfig);

  const fmt = (val) => {
    if (val == null) return '';
    return typeof formatAmount === 'function' ? formatAmount(val, currency) : String(val);
  };

  const canShowDiscount = !readOnly && !!lineConfig?.discountField;

  // --- Render ---

  if (!discountPanelOpen) {
    // Simple mode
    return (
      <div className="mt-1 flex flex-col items-end" data-inline-add-portal="true">
        <div className="w-full max-w-xs text-sm">
          {canShowDiscount && (
            <button
              type="button"
              onClick={() => setDiscountPanelOpen(true)}
              className="mb-3 px-2 text-xs text-primary underline underline-offset-2 hover:opacity-70 transition-opacity cursor-pointer bg-transparent border-0 text-left"
            >
              + {ui('addDiscount')}
            </button>
          )}
          <div style={{ borderTopWidth: '0.5px', borderTopStyle: 'solid', borderTopColor: 'var(--border)' }}>
            {netSubtotal != null && (
              <div className="flex justify-between py-2 px-2">
                <span className="text-muted-foreground">{ui('subtotal')}</span>
                <span className="tabular-nums">{fmt(netSubtotal)}</span>
              </div>
            )}
            <div style={{ borderTopWidth: '0.5px', borderTopStyle: 'solid', borderTopColor: 'var(--border)' }} />
            <div className="flex justify-between py-2 px-2">
              <span className="text-muted-foreground">{ui('tax')}</span>
              <span className="tabular-nums">{fmt(taxAmt ?? 0)}</span>
            </div>
            <div style={{ borderTopWidth: '0.5px', borderTopStyle: 'solid', borderTopColor: 'var(--border)' }} />
            {grandTotal != null && (
              <div className="flex justify-between py-2 px-2 font-semibold">
                <span>{ui('total')}</span>
                <span className="tabular-nums">{fmt(grandTotal)}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  const divider = <div style={{ borderTopWidth: '0.5px', borderTopStyle: 'solid', borderTopColor: 'var(--border)' }} />;

  // Expanded mode
  return (
    <div className="mt-1 flex justify-end" data-inline-add-portal="true">
      <div className="w-full max-w-xs text-sm">
        {/* Gross subtotal — bold, no top border */}
        {grossSubtotal != null && (
          <div className="flex justify-between py-2 px-2">
            <span className="font-semibold">{ui('subtotalWithoutDiscount')}</span>
            <span className="tabular-nums font-semibold">{fmt(grossSubtotal)}</span>
          </div>
        )}

        {/* Discount per product row with checkbox */}
        {lineConfig?.discountField && (
          <div className="flex justify-between items-center py-2 px-2">
            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={discountPerProductEnabled}
                onChange={(e) => onDiscountPerProductChange?.(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
              />
              <span className={`whitespace-nowrap ${discountPerProductEnabled ? 'text-foreground' : 'text-muted-foreground'}`}>
                {ui('discountPerProduct')}
              </span>
            </label>
            <span className="tabular-nums text-muted-foreground">
              {discountAmt != null && discountAmt > 0
                ? `-${fmt(discountAmt)}`
                : fmt(0)}
            </span>
          </div>
        )}

        {/* Divider between discount section and net totals */}
        {divider}

        {/* Net subtotal */}
        {netSubtotal != null && (
          <div className="flex justify-between py-2 px-2">
            <span className="text-muted-foreground">{ui('subtotal')}</span>
            <span className="tabular-nums">{fmt(netSubtotal)}</span>
          </div>
        )}

        {/* Divider + Tax */}
        {taxAmt != null && taxAmt !== 0 && (
          <>
            {divider}
            <div className="flex justify-between py-2 px-2">
              <span className="text-muted-foreground">{ui('tax')}</span>
              <span className="tabular-nums">{fmt(taxAmt)}</span>
            </div>
          </>
        )}

        {/* Divider + Total — bold */}
        {grandTotal != null && (
          <>
            {divider}
            <div className="flex justify-between py-2 px-2 font-semibold">
              <span>{ui('total')}</span>
              <span className="tabular-nums">{fmt(grandTotal)}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

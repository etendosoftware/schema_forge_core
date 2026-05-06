import { useState, useEffect } from 'react';
import { useUI } from '@/i18n';
import { computeDocumentTotals } from '@/lib/documentTotals';

/**
 * DocumentTotalsPanel — generic totals block for document detail views.
 *
 * The discount column in the lines grid is always visible (static).
 *
 * "Subtotal without discount" + "Discount per product" rows appear automatically
 * when at least one line carries a non-zero discount — no user interaction needed.
 *
 * "+ Add total discount" button appears when no total discount is active. Clicking it
 * shows a checkbox (checked) + amount + input/type selector. Unchecking collapses the
 * section and restores the button.
 *
 * Props:
 *   lines                  — array of line row objects (hook.children)
 *   pendingLine            — optional: in-progress add-row values (live snapshot)
 *   editingLine            — optional: sidebar editing values (live snapshot)
 *   lineConfig             — { qtyField, priceField, discountField, grossField }
 *   formatAmount           — function(amount, currency?) → formatted string
 *   currency               — currency identifier string (e.g. 'USD', 'EUR')
 *   readOnly               — boolean — when true hides the "+ Add total discount" button
 *   totalDiscountPct       — number from header record (emEtgoTotalDiscount); restores panel on load
 *   onTotalDiscountChange  — callback(pct: number) — called when user changes or removes the discount
 */
export default function DocumentTotalsPanel({
  lines = [],
  pendingLine = null,
  editingLine = null,
  lineConfig,
  formatAmount,
  currency,
  readOnly = false,
  totalDiscountPct = 0,
  onTotalDiscountChange,
}) {
  const ui = useUI();
  const [totalDiscountOpen, setTotalDiscountOpen] = useState(totalDiscountPct > 0);
  const [inputPct, setInputPct] = useState(totalDiscountPct || 0);

  // Sync panel state when the loaded record changes (e.g., navigating between records).
  useEffect(() => {
    setTotalDiscountOpen(totalDiscountPct > 0);
    setInputPct(totalDiscountPct || 0);
  }, [totalDiscountPct]);

  // Auto-collapse only when lines are cleared AND there is no server-saved discount.
  // Without this guard the panel closes during async load (header arrives before lines),
  // leaving totalDiscountOpen=false while inputPct still holds the saved percentage.
  useEffect(() => {
    if (lines.length === 0 && pendingLine == null && totalDiscountPct <= 0) {
      setTotalDiscountOpen(false);
    }
  }, [lines.length, pendingLine, totalDiscountPct]);

  const { grossSubtotal, netSubtotal, grandTotal, discountAmt, taxAmt, totalDiscountAmt } =
    computeDocumentTotals(lines, pendingLine, editingLine, lineConfig, inputPct);

  const fmt = (val) => {
    if (val == null) return '';
    return typeof formatAmount === 'function' ? formatAmount(val, currency) : String(val);
  };

  const hasPerProductDiscount = discountAmt != null && discountAmt > 0;
  const canShowTotalDiscount = !readOnly && !!lineConfig?.discountField && (lines.length > 0 || pendingLine != null);

  const divider = (
    <div style={{ borderTopWidth: '0.5px', borderTopStyle: 'solid', borderTopColor: 'var(--border)' }} />
  );

  return (
    <div className="mt-1 flex flex-col items-end" data-inline-add-portal="true">
      <div className="w-full max-w-xs text-sm">

        {/* Button — hidden once total discount is active */}
        {canShowTotalDiscount && !totalDiscountOpen && (
          <button
            type="button"
            onClick={() => setTotalDiscountOpen(true)}
            className="mb-3 px-2 text-xs text-primary underline underline-offset-2 hover:opacity-70 transition-opacity cursor-pointer bg-transparent border-0 text-left"
          >
            + {ui('addTotalDiscount')}
          </button>
        )}

        {/*
          Top border only when no per-product discount rows are shown.
          When per-product discount rows are present they start the block visually
          and need no separator above them.
        */}
        <div style={!(hasPerProductDiscount || totalDiscountOpen) ? { borderTopWidth: '0.5px', borderTopStyle: 'solid', borderTopColor: 'var(--border)' } : {}}>

          {/* Gross subtotal header — shown whenever any discount section is active */}
          {(hasPerProductDiscount || totalDiscountOpen) && (
            <div className="flex justify-between py-2 px-2">
              <span className="font-semibold">{ui('subtotalWithoutDiscount')}</span>
              <span className="tabular-nums font-semibold">{fmt(grossSubtotal)}</span>
            </div>
          )}

          {/* Per-product discount row — only when lines actually carry a discount */}
          {hasPerProductDiscount && (
            <div className="flex justify-between py-2 px-2">
              <span className="text-muted-foreground">{ui('discountPerProduct')}</span>
              <span className="tabular-nums text-muted-foreground">-{fmt(discountAmt)}</span>
            </div>
          )}

          {/* Total discount — read-only display for completed documents, interactive otherwise */}
          {totalDiscountOpen && (
            readOnly ? (
              <div className="flex justify-between items-center py-2 px-2">
                <span className="text-muted-foreground whitespace-nowrap">
                  {ui('totalDiscount')} ({inputPct}%)
                </span>
                <span className="tabular-nums text-muted-foreground">-{fmt(totalDiscountAmt ?? 0)}</span>
              </div>
            ) : (
              <>
                <div className="flex justify-between items-center py-2 px-2">
                  <label className="flex items-center gap-1.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked
                      onChange={() => {
                        setTotalDiscountOpen(false);
                        setInputPct(0);
                        onTotalDiscountChange?.(0);
                      }}
                      className="h-3.5 w-3.5 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                    />
                    <span className="whitespace-nowrap">{ui('totalDiscount')}</span>
                  </label>
                  <span className="tabular-nums text-muted-foreground">-{fmt(totalDiscountAmt ?? 0)}</span>
                </div>
                <div className="flex items-center gap-2 pl-[1.75rem] pr-2 pb-2">
                  <input
                    type="number"
                    value={inputPct}
                    min={0}
                    max={100}
                    onChange={e => setInputPct(Number(e.target.value))}
                    onBlur={e => {
                      const v = Math.max(0, Math.min(100, Number(e.target.value)));
                      setInputPct(v);
                      onTotalDiscountChange?.(v);
                    }}
                    className="w-16 text-xs border border-border/60 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary/30"
                    style={{ borderWidth: '0.5px' }}
                  />
                  <span className="text-xs text-muted-foreground">%</span>
                </div>
              </>
            )
          )}

          {/* Separator before net totals — only when discount rows precede them */}
          {(hasPerProductDiscount || totalDiscountOpen) && divider}

          {/* Net subtotal — deducts totalDiscountAmt when active (0 when no discount, so always safe) */}
          {netSubtotal != null && (
            <div className="flex justify-between py-2 px-2">
              <span className="text-muted-foreground">{ui('subtotal')}</span>
              <span className="tabular-nums">{fmt(totalDiscountAmt != null ? netSubtotal - totalDiscountAmt : netSubtotal)}</span>
            </div>
          )}

          {/* Tax */}
          {taxAmt != null && taxAmt !== 0 && (
            <>
              {divider}
              <div className="flex justify-between py-2 px-2">
                <span className="text-muted-foreground">{ui('tax')}</span>
                <span className="tabular-nums">{fmt(taxAmt)}</span>
              </div>
            </>
          )}

          {/* Total — bold */}
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
    </div>
  );
}

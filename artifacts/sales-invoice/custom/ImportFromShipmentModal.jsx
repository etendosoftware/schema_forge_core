import { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { useUI } from '@/i18n';

export default function ImportFromShipmentModal({ invoiceId, bpId, base, headers, onClose, onSuccess }) {
  const ui = useUI();
  const [shipments, setShipments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(new Set());
  const [expanded, setExpanded] = useState(new Set());
  const [shipmentLines, setShipmentLines] = useState({});
  const [loadingLines, setLoadingLines] = useState(new Set());
  const [importing, setImporting] = useState(false);
  const [search, setSearch] = useState('');
  const [lineQuantities, setLineQuantities] = useState({});
  const [alreadyImported, setAlreadyImported] = useState({ shipmentLines: new Set(), orderLines: new Set() });
  const [invoiceHeader, setInvoiceHeader] = useState({});
  // Map of productId → { product_PSTD, product_PLIST, product_UOM, ... } — auxiliary price
  // data returned by the product selector. Mirrors what InlineAddRow passes to the callout.
  const [productAuxMap, setProductAuxMap] = useState({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Fetch shipments, existing invoice lines, invoice header, and product price aux in parallel
        const [shipRes, invLinesRes, headerRes, selectorRes] = await Promise.all([
          fetch(`${base}/goods-shipment/goodsShipment?_startRow=0&_endRow=500`, { headers }),
          fetch(`${base}/sales-invoice/lines?parentId=${invoiceId}&_startRow=0&_endRow=200`, { headers }),
          fetch(`${base}/sales-invoice/header/${invoiceId}`, { headers }),
          fetch(`${base}/sales-invoice/lines/selectors/M_Product_ID?limit=500&offset=0`, { headers }),
        ]);

        // Get IDs of shipment lines and order lines already in this invoice
        const alreadyImportedShipmentLines = new Set();
        const alreadyImportedOrderLines = new Set();
        if (invLinesRes.ok && !cancelled) {
          const invLines = (await invLinesRes.json())?.response?.data || [];
          invLines.forEach(il => {
            if (il.mInoutlineId) alreadyImportedShipmentLines.add(il.mInoutlineId);
            if (il.cOrderlineId) alreadyImportedOrderLines.add(il.cOrderlineId);
          });
        }

        if (headerRes.ok && !cancelled) {
          const hData = (await headerRes.json())?.response?.data?.[0] || {};
          setInvoiceHeader(hData);
        }

        // Build product → aux map from selector response.
        // The selector returns { items: [{ id, label, _aux: { _PSTD, _PLIST, _UOM, _CURR, _PLIM } }] }
        // These become product_PSTD, product_PLIST, etc. in the callout formState — same as
        // what InlineAddRow injects from selectedItem._aux when a product is picked manually.
        if (selectorRes.ok && !cancelled) {
          const selData = await selectorRes.json();
          const auxMap = {};
          for (const item of (selData?.items || [])) {
            if (item.id && item._aux) {
              const aux = {};
              for (const [suffix, val] of Object.entries(item._aux)) {
                aux[`product${suffix}`] = val; // "_PSTD" → "product_PSTD"
              }
              auxMap[item.id] = aux;
            }
          }
          setProductAuxMap(auxMap);
        }

        if (shipRes.ok && !cancelled) {
          const all = (await shipRes.json())?.response?.data || [];
          setShipments(all.filter(s =>
            s.documentStatus === 'CO'
            && s.businessPartner === bpId
            && s.invoiced !== true
          ));
          setAlreadyImported({ shipmentLines: alreadyImportedShipmentLines, orderLines: alreadyImportedOrderLines });
        }
      } catch { /* silent */ }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [bpId, base, headers, invoiceId]);

  const bpName = shipments[0]?.['businessPartner$_identifier'] || '';

  const filtered = useMemo(() => {
    if (!search.trim()) return shipments;
    const q = search.toLowerCase();
    return shipments.filter(s => (s.documentNo || '').toLowerCase().includes(q));
  }, [shipments, search]);

  /**
   * Resolves unitPrice, tax, uOM, and lineNetAmount for a product via the same
   * callout mechanism used by manual line entry (SL_Invoice_Product + SL_Invoice_Amt cascade).
   *
   * auxData: product_PSTD, product_PLIST, etc. from the product selector — required so the
   * callout can look up the price. Without these, grossUnitPrice returns 0.
   */
  const resolveLinePrice = async (productId, qty, currentHeader, auxData = {}) => {
    const formState = {
      ...currentHeader,
      ...auxData,        // product_PSTD, product_PLIST, product_UOM, product_CURR, product_PLIM
      product: productId,
      invoicedQuantity: qty || 1,
    };
    try {
      // Extract auxiliaryValues (e.g. product_PSTD, product_UOM) — DetailView.jsx passes these
      // as a separate top-level field in the callout payload, which the backend uses specifically
      // to resolve the price. Without this the callout returns grossUnitPrice=0.
      const auxiliaryValues = {};
      for (const [k, v] of Object.entries(formState)) {
        if (/^[a-zA-Z]+_[A-Z]{2,4}$/.test(k) && v != null && v !== '') {
          auxiliaryValues[k] = String(v);
        }
      }

      // First callout: "product" field → SL_Invoice_Product (resolves grossUnitPrice/unitPrice, tax, uOM).
      // Field must be "product" (API key), not "M_Product_ID" — same as what InlineAddRow sends.
      const res = await fetch(`${base}/sales-invoice/lines/callout`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          field: 'product', value: productId, formState,
          ...(Object.keys(auxiliaryValues).length > 0 ? { auxiliaryValues } : {}),
        }),
      });
      if (!res.ok) return {};
      const data = await res.json();
      const result = {};
      if (data.updates) {
        for (const [k, entry] of Object.entries(data.updates)) result[k] = entry.value;
      }
      if (data.combos) {
        for (const [k, combo] of Object.entries(data.combos)) {
          if (combo.selected != null) result[k] = combo.selected;
        }
      }

      // Mirror DetailView.jsx: grossUnitPrice is the gross price for tax-included price lists;
      // unitPrice starts as 0 and is derived by the cascade. Fall back to grossUnitPrice when
      // unitPrice is 0 so the cascade has a non-zero value to work with.
      let unitPrice = Number(result.unitPrice) || Number(result.grossUnitPrice) || 0;
      if (unitPrice) result.unitPrice = unitPrice;

      // Cascade: PriceActual → SL_Invoice_Amt (computes lineNetAmount = unitPrice * qty)
      if (unitPrice) {
        // Use the actual import qty so lineNetAmount is calculated for the right quantity.
        // result may contain invoicedQuantity:0 from the first callout — override it.
        const cascadeState = { ...formState, ...result, invoicedQuantity: qty || 1 };
        const cascadeRes = await fetch(`${base}/sales-invoice/lines/callout`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ field: 'PriceActual', value: String(unitPrice), formState: cascadeState }),
        });
        if (cascadeRes.ok) {
          const cascadeData = await cascadeRes.json();
          if (cascadeData.updates) {
            for (const [k, entry] of Object.entries(cascadeData.updates)) {
              result[k] = entry.value;
            }
          }
          if (cascadeData.combos) {
            for (const [k, combo] of Object.entries(cascadeData.combos)) {
              if (combo.selected != null && !(k in result)) result[k] = combo.selected;
            }
          }
        }
      }
      return result;
    } catch {
      return {};
    }
  };

  const fetchLines = async (shipmentId) => {
    if (shipmentLines[shipmentId] || loadingLines.has(shipmentId)) return;
    setLoadingLines(prev => { const n = new Set(prev); n.add(shipmentId); return n; });
    try {
      const res = await fetch(`${base}/goods-shipment/goodsShipmentLine?parentId=${shipmentId}&_startRow=0&_endRow=200`, { headers });
      if (res.ok) {
        const json = await res.json();
        const lines = json?.response?.data || [];

        // Resolve price for each line via callout (same mechanism as manual line entry)
        const currentHeader = invoiceHeader;
        const currentAuxMap = productAuxMap;
        const enrichedLines = await Promise.all(lines.map(async (l) => {
          const imported = alreadyImported.shipmentLines?.has(l.id) || alreadyImported.orderLines?.has(l.salesOrderLine); // l.id = goodsShipmentLine id; l.salesOrderLine from goods-shipment contract (apiKey: "salesOrderLine")
          const qty = Number(l.movementQuantity) || 1;
          const priceData = l.product ? await resolveLinePrice(l.product, qty, currentHeader, currentAuxMap[l.product] || {}) : {};
          return {
            ...l,
            _unitPrice: Number(priceData.unitPrice) || Number(priceData.grossUnitPrice) || 0,
            _lineNetAmount: Number(priceData.lineNetAmount ?? 0),
            _tax: priceData.tax || null,
            _uOM: priceData.uOM || l.uOM || null,
            _alreadyImported: !!imported,
          };
        }));

        setShipmentLines(prev => ({ ...prev, [shipmentId]: enrichedLines }));
        const qtyDefaults = {};
        const newSelected = new Set();
        enrichedLines.forEach(l => {
          qtyDefaults[l.id] = Number(l.movementQuantity) || 0;
          if (!l._alreadyImported) newSelected.add(l.id);
        });
        setLineQuantities(prev => ({ ...prev, ...qtyDefaults }));
        setSelected(prev => { const n = new Set(prev); newSelected.forEach(id => n.add(id)); return n; });
      }
    } catch { /* silent */ }
    finally { setLoadingLines(prev => { const n = new Set(prev); n.delete(shipmentId); return n; }); }
  };

  const toggleExpand = (shipmentId) => {
    setExpanded(prev => {
      const n = new Set(prev);
      if (n.has(shipmentId)) { n.delete(shipmentId); } else { n.add(shipmentId); fetchLines(shipmentId); }
      return n;
    });
  };

  const toggleLine = (lineId) => {
    setSelected(prev => { const n = new Set(prev); n.has(lineId) ? n.delete(lineId) : n.add(lineId); return n; });
  };

  const toggleShipment = (shipmentId) => {
    const lines = shipmentLines[shipmentId] || [];
    if (lines.length === 0) return;
    const lineIds = lines.map(l => l.id);
    const allSelected = lineIds.every(id => selected.has(id));
    setSelected(prev => {
      const n = new Set(prev);
      if (allSelected) { lineIds.forEach(id => n.delete(id)); } else { lineIds.forEach(id => n.add(id)); }
      return n;
    });
  };

  const getShipmentCheckState = (shipmentId) => {
    const lines = shipmentLines[shipmentId] || [];
    if (lines.length === 0) return { checked: false, indeterminate: false };
    const count = lines.filter(l => selected.has(l.id)).length;
    if (count === 0) return { checked: false, indeterminate: false };
    if (count === lines.length) return { checked: true, indeterminate: false };
    return { checked: false, indeterminate: true };
  };

  const handleImport = async () => {
    if (selected.size === 0 || importing) return;
    setImporting(true);
    try {
      let lineNo = 10;
      let errors = 0;
      const currentHeader = invoiceHeader;

      for (const shipment of shipments) {
        const lines = (shipmentLines[shipment.id] || []).filter(l => selected.has(l.id));
        if (lines.length === 0) continue;

        for (const line of lines) {
          const qty = lineQuantities[line.id] ?? (Number(line.movementQuantity) || 0);

          // Resolve price via callout with the actual quantity being imported.
          // This mirrors what happens when a line is added manually: SL_Invoice_Product
          // sets the unit price from the price list, and SL_Invoice_Amt computes lineNetAmount.
          const priceData = await resolveLinePrice(line.product, qty, currentHeader, productAuxMap[line.product] || {});
          const grossUnitPrice = Number(priceData.grossUnitPrice) || 0;
          const unitPrice = Number(priceData.unitPrice) || grossUnitPrice || Number(line._unitPrice) || 0;
          const lineNetAmount = Number(priceData.lineNetAmount) || qty * unitPrice;
          const tax = priceData.tax || line._tax || null;
          const uOM = priceData.uOM || line._uOM || line.uOM || null;

          const lineBody = {
            parentId: invoiceId,
            product: line.product,
            invoicedQuantity: qty,
            unitPrice,
            // For tax-included price lists (GROSSPRICE='Y'), the server derives unitPrice and
            // lineNetAmount from grossUnitPrice. Sending it ensures correct calculation even when
            // the server's own callout would otherwise reset unitPrice to 0.
            ...(grossUnitPrice ? { grossUnitPrice } : {}),
            lineNetAmount,
            tax,
            uOM,
            lineNo,
            mInoutlineId: line.id,         // sales-invoice lines contract: apiKey "mInoutlineId" (M_InOutLine_ID)
            cOrderlineId: line.salesOrderLine || null, // sales-invoice lines contract: apiKey "cOrderlineId"; value from goods-shipment line field "salesOrderLine"
          };
          const res = await fetch(`${base}/sales-invoice/lines`, {
            method: 'POST', headers, body: JSON.stringify(lineBody),
          });
          if (!res.ok) errors++;
          lineNo += 10;
        }
      }
      if (errors > 0) {
        toast.warning(`Imported with ${errors} error(s) — review the invoice`);
        console.warn('[ImportFromShipment] Completed with errors:', errors);
      } else {
        toast.success(`${lineNo / 10 - 1} lines imported`);
      }
      onSuccess();
    } catch (err) { toast.error(err.message || 'Failed to import'); }
    finally { setImporting(false); }
  };

  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '-';
  const fmtNum = (v) => v != null ? Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-';

  return (
    <div onClick={onClose} className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div onClick={e => e.stopPropagation()} style={{ width: 580, maxHeight: '80vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRadius: 12, backgroundColor: '#fff', boxShadow: '0 8px 30px rgba(0,0,0,0.12)', border: '0.5px solid #E5E7EB' }}>

        <div style={{ padding: '14px 16px', borderBottom: '2px solid #E5E7EB' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>{ui('importFromShipment')}</span>
            <button type="button" onClick={onClose} style={{ fontSize: 18, lineHeight: 1, padding: '2px 6px', borderRadius: 4, background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280' }}>&times;</button>
          </div>
          {bpName && <div style={{ fontSize: 13, color: '#9ca3af', marginTop: 2 }}>{bpName}</div>}
        </div>

        <div style={{ padding: '10px 16px 0' }}>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={ui('siImportSearchShipmentPlaceholder')}
            style={{ width: '100%', fontSize: 13, padding: '7px 10px', border: '0.5px solid #E5E7EB', borderRadius: 6, outline: 'none', color: '#111827' }}
          />
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 0 }}>
          {loading ? (
            <p style={{ fontSize: 13, color: '#9ca3af', padding: '24px 0', textAlign: 'center' }}>{ui('loading')}</p>
          ) : filtered.length === 0 ? (
            <p style={{ fontSize: 13, color: '#9ca3af', padding: '24px 0', textAlign: 'center' }}>
              {shipments.length === 0 ? 'No pending shipments to invoice for this customer.' : 'No shipments match your search.'}
            </p>
          ) : (
            filtered.map(s => {
              const isExpanded = expanded.has(s.id);
              const isLoadingLns = loadingLines.has(s.id);
              const lines = shipmentLines[s.id] || [];
              const checkState = getShipmentCheckState(s.id);
              const hasAnySelected = checkState.checked || checkState.indeterminate;
              const orderRef = (s['salesOrder$_identifier'] || '').split(' - ')[0] || '';
              const shipmentTotal = lines.length > 0
                ? lines.reduce((sum, l) => sum + (l._lineNetAmount || 0), 0)
                : null;
              return (
                <div key={s.id} style={{ borderLeft: (isExpanded || hasAnySelected) ? '3px solid var(--color-border-info, #3b82f6)' : '3px solid transparent' }}>
                  <div
                    style={{ display: 'flex', alignItems: 'center', padding: '10px 12px', borderBottom: '0.5px solid #F3F4F6', cursor: 'pointer' }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#F9FAFB'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                    onClick={() => toggleExpand(s.id)}
                  >
                    <span style={{ fontSize: 11, color: '#9ca3af', width: 16, textAlign: 'center', transition: 'transform 0.15s', transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)', flexShrink: 0 }}>▶</span>
                    <input
                      type="checkbox"
                      checked={checkState.checked}
                      ref={el => { if (el) el.indeterminate = checkState.indeterminate; }}
                      onChange={e => { e.stopPropagation(); toggleShipment(s.id); }}
                      onClick={e => e.stopPropagation()}
                      style={{ accentColor: '#3b82f6', cursor: 'pointer', margin: '0 8px', flexShrink: 0 }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{s.documentNo || s.id}</span>
                        <span style={{ fontSize: 12, color: '#6B7280' }}>{fmtDate(s.movementDate)}</span>
                      </div>
                    </div>
                    <span style={{ fontSize: 12, color: '#9ca3af', fontVariantNumeric: 'tabular-nums', flexShrink: 0, marginLeft: 8 }}>
                      {shipmentTotal != null ? fmtNum(shipmentTotal) : (orderRef ? `#${orderRef}` : '')}
                    </span>
                  </div>

                  {isExpanded && (
                    <div style={{ background: 'var(--color-background-secondary, #F9FAFB)' }}>
                      {isLoadingLns ? (
                        <div style={{ padding: '8px 12px 8px 48px', fontSize: 12, color: '#9ca3af' }}>{ui('loadingLines')}</div>
                      ) : lines.length === 0 ? (
                        <div style={{ padding: '8px 12px 8px 48px', fontSize: 12, color: '#9ca3af' }}>{ui('noLinesFound')}</div>
                      ) : (
                        <>
                          <div style={{ display: 'flex', padding: '4px 12px 4px 48px', fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '0.5px solid #E5E7EB' }}>
                            <span style={{ flex: 1 }}>{ui('product')}</span>
                            <span style={{ width: 70, textAlign: 'right' }}>{ui('qty')}</span>
                            <span style={{ width: 80, textAlign: 'right' }}>{ui('siImportColPrice')}</span>
                            <span style={{ width: 80, textAlign: 'right' }}>{ui('amount')}</span>
                          </div>
                          {lines.map(line => {
                            const imported = line._alreadyImported;
                            const lineSelected = !imported && selected.has(line.id);
                            const productName = line['product$_identifier'] || line.id;
                            const maxQty = Number(line.movementQuantity) || 0;
                            const currentQty = lineQuantities[line.id] ?? maxQty;
                            const qtyEdited = currentQty !== maxQty;
                            const unitPrice = line._unitPrice || null;
                            const lineTotal = unitPrice != null ? unitPrice * currentQty : null;
                            return (
                              <div
                                key={line.id}
                                onClick={() => !imported && toggleLine(line.id)}
                                style={{
                                  display: 'flex', alignItems: 'center', padding: '6px 12px 6px 48px', borderBottom: '0.5px solid #F3F4F6',
                                  cursor: imported ? 'default' : 'pointer',
                                  background: lineSelected ? '#eff6ff' : 'transparent',
                                  opacity: imported ? 0.4 : 1,
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={lineSelected}
                                  disabled={imported}
                                  onChange={() => !imported && toggleLine(line.id)}
                                  onClick={e => e.stopPropagation()}
                                  style={{ accentColor: '#3b82f6', cursor: imported ? 'not-allowed' : 'pointer', marginRight: 8, flexShrink: 0 }}
                                />
                                <span style={{ fontSize: 13, color: imported ? '#9ca3af' : lineSelected ? '#2563eb' : '#111827', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: lineSelected ? 500 : 400 }}>
                                  {productName}{imported && <span style={{ fontSize: 11, marginLeft: 6, color: '#9ca3af' }}>{ui('siImportAlreadyImported')}</span>}
                                </span>
                                <span style={{ width: 70, flexShrink: 0, textAlign: 'right' }}>
                                  <input
                                    type="number"
                                    min={1}
                                    max={maxQty}
                                    value={currentQty}
                                    onClick={e => e.stopPropagation()}
                                    onChange={e => {
                                      const v = Math.max(1, Math.min(maxQty, Number(e.target.value) || 1));
                                      setLineQuantities(prev => ({ ...prev, [line.id]: v }));
                                    }}
                                    style={{
                                      width: 60, fontSize: 12, padding: '3px 4px', borderRadius: 4, textAlign: 'center', fontVariantNumeric: 'tabular-nums', outline: 'none',
                                      border: qtyEdited ? '1px solid var(--color-border-warning, #f59e0b)' : '0.5px solid var(--color-border-secondary, #d1d5db)',
                                      background: qtyEdited ? 'var(--color-background-warning, #fffbeb)' : '#fff',
                                    }}
                                  />
                                </span>
                                <span style={{ width: 80, fontSize: 12, color: '#6B7280', fontVariantNumeric: 'tabular-nums', textAlign: 'right', flexShrink: 0 }}>
                                  {unitPrice ? fmtNum(unitPrice) : '-'}
                                </span>
                                <span style={{ width: 80, fontSize: 12, color: '#6B7280', fontVariantNumeric: 'tabular-nums', textAlign: 'right', flexShrink: 0 }}>
                                  {lineTotal ? fmtNum(lineTotal) : '-'}
                                </span>
                              </div>
                            );
                          })}
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#F8F9FA', borderTop: '1px solid #E5E7EB', padding: '10px 16px' }}>
          <span style={{ fontSize: 12, color: selected.size > 0 ? 'var(--color-text-info, #2563eb)' : '#6B7280', fontWeight: selected.size > 0 ? 500 : 400 }}>
            {selected.size > 0 ? `${selected.size} line${selected.size > 1 ? 's' : ''} selected` : 'Select lines to import'}
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={onClose} style={{ fontSize: 13, padding: '5px 14px', borderRadius: 6, border: '1px solid #E5E7EB', background: 'transparent', color: '#6B7280', cursor: 'pointer' }}>{ui('cancel')}</button>
            <button
              type="button" onClick={handleImport} disabled={selected.size === 0 || importing}
              style={{ fontSize: 13, fontWeight: 500, padding: '5px 14px', borderRadius: 6, border: 'none', background: '#18181b', color: '#fff', cursor: (selected.size === 0 || importing) ? 'not-allowed' : 'pointer', opacity: (selected.size === 0 || importing) ? 0.4 : 1 }}
            >
              {importing ? 'Importing...' : `Import selected${selected.size > 0 ? ` (${selected.size})` : ''}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

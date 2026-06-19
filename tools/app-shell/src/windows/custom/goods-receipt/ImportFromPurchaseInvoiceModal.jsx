import ImportLinesModal from '@/components/contract-ui/ImportLinesModal';

function enrichLines(lines) {
  return lines
    .map(l => {
      const qty = Number(l.invoicedQuantity) || 0;
      const alreadyLinked = !!l.goodsShipmentLine;
      return {
        ...l,
        _productName: l['product$_identifier'] || l.id,
        _maxQty: alreadyLinked ? 0 : qty,
        _alreadyImported: alreadyLinked,
      };
    })
    .filter(l => Number(l.invoicedQuantity) > 0);
}

const fetchDocuments = async ({ base, headers, bpId }) => {
  const res = await fetch(
    `${base}/purchase-invoice/header?_startRow=0&_endRow=500&_sortBy=creationDate desc`,
    { headers },
  );
  if (!res.ok) return { documents: [], sharedContext: { linesCache: {} } };

  const all = (await res.json())?.response?.data || [];
  const candidates = all.filter(o =>
    o.documentStatus === 'CO'
    && o.businessPartner === bpId
    && Number(o.grandTotalAmount ?? 0) >= 0
  );

  // Pre-fetch lines for all candidates in parallel to filter out fully-imported invoices.
  const lineResults = await Promise.all(
    candidates.map(async inv => {
      try {
        const r = await fetch(
          `${base}/purchase-invoice/lines?parentId=${inv.id}&_startRow=0&_endRow=200`,
          { headers },
        );
        return { id: inv.id, lines: r.ok ? (await r.json())?.response?.data || [] : [] };
      } catch {
        return { id: inv.id, lines: [] };
      }
    }),
  );

  const linesCache = {};
  lineResults.forEach(r => { linesCache[r.id] = r.lines; });

  // Only show invoices that still have at least one line not yet received.
  const documents = candidates.filter(inv => {
    const lines = linesCache[inv.id] || [];
    return lines.some(l => !l.goodsShipmentLine && Number(l.invoicedQuantity) > 0);
  });

  return { documents, sharedContext: { linesCache } };
};

const fetchLines = async ({ base, headers, docId, sharedContext }) => {
  const cached = sharedContext?.linesCache?.[docId];
  if (cached) return enrichLines(cached);
  try {
    const res = await fetch(
      `${base}/purchase-invoice/lines?parentId=${docId}&_startRow=0&_endRow=200`,
      { headers },
    );
    return res.ok ? enrichLines((await res.json())?.response?.data || []) : [];
  } catch {
    return [];
  }
};

const getDocDisplay = (doc) => ({
  docNo: doc.documentNo || doc.id,
  date: doc.invoiceDate,
});

const buildLineBody = async ({ line, qty, invoiceId: receiptId, lineNo }) => ({
  parentId: receiptId,
  product: line.product,
  movementQuantity: qty,
  uOM: line.uOM || null,
  // invoiceLineId is a custom field captured by AbstractInOutLineHandler.handle()
  // before NeoFieldFilter strips it. afterHandle() sets c_invoiceline.m_inoutline_id.
  invoiceLineId: line.id,
  lineNo,
});

export default function ImportFromPurchaseInvoiceModal({ receiptId, ...rest }) {
  return (
    <ImportLinesModal
      {...rest}
      invoiceId={receiptId}
      linesEndpoint="goods-receipt/goodsReceiptLine"
      titleKey="importFromPurchaseInvoice"
      searchPlaceholderKey="searchPurchaseInvoice"
      emptyMessageKey="noCompletedPurchaseInvoicesForThisVendor"
      noSearchResultsKey="noInvoicesMatchYourSearch"
      successMessageKey="linesImportedFromPurchaseInvoice"
      showPriceColumns={false}
      fetchDocuments={fetchDocuments}
      fetchLines={fetchLines}
      getDocDisplay={getDocDisplay}
      buildLineBody={buildLineBody}
      data-testid="ImportLinesModal__ee0cc2" />
  );
}

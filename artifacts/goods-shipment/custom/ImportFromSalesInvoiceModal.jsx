import ImportLinesModal from '@/components/contract-ui/ImportLinesModal';

const fetchDocuments = async ({ base, headers, bpId, invoiceId: shipmentId }) => {
  const [invoicesRes, shipmentLinesRes] = await Promise.all([
    fetch(`${base}/sales-invoice/header?_startRow=0&_endRow=500&_sortBy=creationDate desc`, { headers }),
    fetch(`${base}/goods-shipment/goodsShipmentLine?parentId=${shipmentId}&_startRow=0&_endRow=200`, { headers }),
  ]);

  const alreadyAddedInvoiceLines = new Set();
  if (shipmentLinesRes.ok) {
    const existing = (await shipmentLinesRes.json())?.response?.data || [];
    existing.forEach(l => { if (l.salesInvoiceLine) alreadyAddedInvoiceLines.add(l.salesInvoiceLine); });
  }

  let documents = [];
  if (invoicesRes.ok) {
    const all = (await invoicesRes.json())?.response?.data || [];
    documents = all.filter(o => o.documentStatus === 'CO' && o.businessPartner === bpId);
  }
  return { documents, sharedContext: { alreadyAddedInvoiceLines } };
};

const fetchLines = async ({ base, headers, docId, sharedContext }) => {
  const res = await fetch(`${base}/sales-invoice/lines?parentId=${docId}&_startRow=0&_endRow=200`, { headers });
  if (!res.ok) return [];
  const lines = (await res.json())?.response?.data || [];
  return lines.map(l => {
    const qty = Number(l.invoicedQuantity) || 0;
    return {
      ...l,
      _productName: l['product$_identifier'] || l.id,
      _maxQty: qty,
      _unitPrice: 0,
      _lineNetAmount: 0,
      _alreadyImported: sharedContext.alreadyAddedInvoiceLines?.has(l.id) || qty === 0,
    };
  });
};

const getDocDisplay = (doc) => ({ docNo: doc.documentNo || doc.id, date: doc.invoiceDate });

const buildLineBody = async ({ line, qty, invoiceId: shipmentId, lineNo }) => ({
  parentId: shipmentId,
  product: line.product,
  movementQuantity: qty,
  uOM: line.uOM || null,
  ...(line.cOrderlineId ? { salesOrderLine: line.cOrderlineId } : {}),
  lineNo,
});

export default function ImportFromSalesInvoiceModal(props) {
  return (
    <ImportLinesModal
      {...props}
      linesEndpoint="goods-shipment/goodsShipmentLine"
      titleKey="importFromSalesInvoice"
      searchPlaceholderKey="searchSalesInvoice"
      emptyMessageKey="noCompletedSalesInvoicesForThisCustomer"
      noSearchResultsKey="noInvoicesMatchYourSearch"
      successMessageKey="linesImportedFromSalesInvoice"
      showPriceColumns={false}
      fetchDocuments={fetchDocuments}
      fetchLines={fetchLines}
      getDocDisplay={getDocDisplay}
      buildLineBody={buildLineBody}
    />
  );
}

import ImportLinesModal from '@/components/contract-ui/ImportLinesModal';

const fetchDocuments = async ({ base, headers, bpId }) => {
  const res = await fetch(
    `${base}/sales-invoice/header?_startRow=0&_endRow=500&_sortBy=creationDate desc`,
    { headers },
  );

  let documents = [];
  const ordersByInvoiceId = {};
  if (res.ok) {
    const all = (await res.json())?.response?.data || [];
    documents = all.filter(o => o.documentStatus === 'CO' && o.businessPartner === bpId);
    documents.forEach(doc => {
      if (doc.salesOrder) ordersByInvoiceId[doc.id] = doc.salesOrder;
    });
  }
  return { documents, sharedContext: { ordersByInvoiceId } };
};

const fetchLines = async ({ base, headers, docId, sharedContext }) => {
  const orderId = sharedContext.ordersByInvoiceId?.[docId];

  const [invoiceLinesRes, orderLinesRes] = await Promise.all([
    fetch(`${base}/sales-invoice/lines?parentId=${docId}&_startRow=0&_endRow=200`, { headers }),
    orderId
      ? fetch(`${base}/sales-order/lines?parentId=${orderId}&_startRow=0&_endRow=200`, { headers })
      : Promise.resolve(null),
  ]);

  if (!invoiceLinesRes.ok) return [];
  const invoiceLines = (await invoiceLinesRes.json())?.response?.data || [];

  const deliveredByOrderLine = {};
  const orderLineByProduct = {};
  if (orderLinesRes?.ok) {
    const orderLines = (await orderLinesRes.json())?.response?.data || [];
    orderLines.forEach(ol => {
      deliveredByOrderLine[ol.id] = Number(ol.deliveredQuantity) || 0;
      if (ol.product) orderLineByProduct[ol.product] = ol.id;
    });
  }

  return invoiceLines.map(l => {
    const qty = Number(l.invoicedQuantity) || 0;
    const alreadyLinked = !!l.goodsShipmentLine;
    // Use direct FK first, fall back to matching by product within the linked order
    const orderLineId = l.salesOrderLine || orderLineByProduct[l.product];
    const delivered = orderLineId ? (deliveredByOrderLine[orderLineId] ?? 0) : 0;
    const pending = alreadyLinked ? 0 : Math.max(0, qty - delivered);
    return {
      ...l,
      _orderLineId: orderLineId,
      _productName: l['product$_identifier'] || l.id,
      _maxQty: pending,
      _unitPrice: 0,
      _lineNetAmount: 0,
      _alreadyImported: pending === 0,
    };
  });
};

const getDocDisplay = (doc) => ({ docNo: doc.documentNo || doc.id, date: doc.invoiceDate });

const buildLineBody = async ({ line, qty, invoiceId: shipmentId, lineNo }) => ({
  parentId: shipmentId,
  product: line.product,
  movementQuantity: qty,
  uOM: line.uOM || null,
  // salesOrderLine sets C_OrderLine_ID → Java handler fills orderQuantity via JOIN
  ...(line._orderLineId ? { salesOrderLine: line._orderLineId } : {}),
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

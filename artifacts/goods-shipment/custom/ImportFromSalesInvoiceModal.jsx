import ImportLinesModal from '@/components/contract-ui/ImportLinesModal';

async function fetchDraftQtyByOrderLine({ base, headers, bpId, currentShipmentId }) {
  const res = await fetch(
    `${base}/goods-shipment/header?_startRow=0&_endRow=100&_sortBy=movementDate desc`,
    { headers },
  );
  if (!res.ok) return {};

  const all = (await res.json())?.response?.data || [];
  const otherDrafts = all.filter(s =>
    s.documentStatus === 'DR' && s.businessPartner === bpId && s.id !== currentShipmentId,
  );
  if (otherDrafts.length === 0) return {};

  const lineResults = await Promise.all(
    otherDrafts.map(s =>
      fetch(`${base}/goods-shipment/goodsShipmentLine?parentId=${s.id}&_startRow=0&_endRow=200`, { headers }),
    ),
  );

  const draftQty = {};
  for (const r of lineResults) {
    if (!r.ok) continue;
    const lines = (await r.json())?.response?.data || [];
    lines.forEach(l => {
      if (l.salesOrderLine) {
        draftQty[l.salesOrderLine] = (draftQty[l.salesOrderLine] || 0) + (Number(l.movementQuantity) || 0);
      }
    });
  }
  return draftQty;
}

const fetchDocuments = async ({ base, headers, bpId, invoiceId: shipmentId }) => {
  const [invoicesRes, draftQtyByOrderLine] = await Promise.all([
    fetch(`${base}/sales-invoice/header?_startRow=0&_endRow=500&_sortBy=creationDate desc`, { headers }),
    fetchDraftQtyByOrderLine({ base, headers, bpId, currentShipmentId: shipmentId }),
  ]);

  let documents = [];
  const ordersByInvoiceId = {};
  if (invoicesRes.ok) {
    const all = (await invoicesRes.json())?.response?.data || [];
    documents = all.filter(o => o.documentStatus === 'CO' && o.businessPartner === bpId);
    documents.forEach(doc => {
      if (doc.salesOrder) ordersByInvoiceId[doc.id] = doc.salesOrder;
    });
  }
  return { documents, sharedContext: { ordersByInvoiceId, draftQtyByOrderLine } };
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
    const orderLineId = l.salesOrderLine || orderLineByProduct[l.product];
    const delivered = orderLineId ? (deliveredByOrderLine[orderLineId] ?? 0) : 0;
    const inOtherDrafts = orderLineId ? (sharedContext.draftQtyByOrderLine?.[orderLineId] || 0) : 0;
    const pending = alreadyLinked ? 0 : Math.max(0, qty - delivered - inOtherDrafts);
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

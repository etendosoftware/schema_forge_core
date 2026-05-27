import ImportLinesModal from '@/components/contract-ui/ImportLinesModal';

async function fetchDraftInfoByOrderLine({ base, headers, bpId, currentShipmentId }) {
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
      fetch(`${base}/goods-shipment/goodsShipmentLine?parentId=${s.id}&_startRow=0&_endRow=200`, { headers })
        .then(r => r.ok ? r.json().then(d => ({ docNo: s.documentNo, lines: d?.response?.data || [] })) : null),
    ),
  );

  const draftInfo = {};
  for (const result of lineResults) {
    if (!result) continue;
    result.lines.forEach(l => {
      if (!l.salesOrderLine) return;
      if (!draftInfo[l.salesOrderLine]) draftInfo[l.salesOrderLine] = { qty: 0, docNos: new Set() };
      draftInfo[l.salesOrderLine].qty += Number(l.movementQuantity) || 0;
      draftInfo[l.salesOrderLine].docNos.add(result.docNo);
    });
  }
  return draftInfo;
}

const fetchDocuments = async ({ base, headers, bpId, invoiceId: shipmentId }) => {
  const [invoicesRes, draftInfo] = await Promise.all([
    fetch(`${base}/sales-invoice/header?_startRow=0&_endRow=500&_sortBy=creationDate desc`, { headers }),
    fetchDraftInfoByOrderLine({ base, headers, bpId, currentShipmentId: shipmentId }),
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
  return { documents, sharedContext: { ordersByInvoiceId, draftInfo } };
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

  const orderLineByProduct = {};
  if (orderLinesRes?.ok) {
    const orderLines = (await orderLinesRes.json())?.response?.data || [];
    orderLines.forEach(ol => {
      if (ol.product) orderLineByProduct[ol.product] = ol.id;
    });
  }

  return invoiceLines.map(l => {
    const qty = Number(l.invoicedQuantity) || 0;
    const alreadyLinked = !!l.goodsShipmentLine;
    const orderLineId = l.salesOrderLine || orderLineByProduct[l.product];
    const draftEntry = orderLineId ? sharedContext.draftInfo?.[orderLineId] : undefined;
    const maxQty = alreadyLinked ? 0 : qty;
    return {
      ...l,
      _orderLineId: orderLineId,
      _productName: l['product$_identifier'] || l.id,
      _maxQty: maxQty,
      _unitPrice: 0,
      _lineNetAmount: 0,
      _alreadyImported: maxQty === 0,
      _inDraftShipments: draftEntry?.docNos?.size ? [...draftEntry.docNos] : undefined,
    };
  });
};

const getDocDisplay = (doc) => ({ docNo: doc.documentNo || doc.id, date: doc.invoiceDate });

const buildLineBody = async ({ line, qty, invoiceId: shipmentId, lineNo }) => ({
  parentId: shipmentId,
  product: line.product,
  movementQuantity: qty,
  uOM: line.uOM || null,
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

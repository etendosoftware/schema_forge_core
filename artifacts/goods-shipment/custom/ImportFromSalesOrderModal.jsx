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
  const [ordersRes, shipmentLinesRes, draftQtyByOrderLine] = await Promise.all([
    fetch(`${base}/sales-order/header?_startRow=0&_endRow=500&_sortBy=creationDate desc`, { headers }),
    fetch(`${base}/goods-shipment/goodsShipmentLine?parentId=${shipmentId}&_startRow=0&_endRow=200`, { headers }),
    fetchDraftQtyByOrderLine({ base, headers, bpId, currentShipmentId: shipmentId }),
  ]);

  const alreadyAddedOrderLines = new Set();
  if (shipmentLinesRes.ok) {
    const existing = (await shipmentLinesRes.json())?.response?.data || [];
    existing.forEach(l => { if (l.salesOrderLine) alreadyAddedOrderLines.add(l.salesOrderLine); });
  }

  let documents = [];
  if (ordersRes.ok) {
    const all = (await ordersRes.json())?.response?.data || [];
    documents = all.filter(o =>
      o.documentStatus === 'CO'
      && o.businessPartner === bpId
      && Number(o.deliveryStatus ?? 100) < 100,
    );
  }
  return { documents, sharedContext: { alreadyAddedOrderLines, draftQtyByOrderLine } };
};

const fetchLines = async ({ base, headers, docId, sharedContext }) => {
  const res = await fetch(`${base}/sales-order/lines?parentId=${docId}&_startRow=0&_endRow=200`, { headers });
  if (!res.ok) return [];
  const lines = (await res.json())?.response?.data || [];
  return lines.map(l => {
    const ordered = Number(l.orderedQuantity) || 0;
    const delivered = Number(l.deliveredQuantity) || 0;
    const inOtherDrafts = sharedContext.draftQtyByOrderLine?.[l.id] || 0;
    const pending = Math.max(0, ordered - delivered - inOtherDrafts);
    return {
      ...l,
      _productName: l['product$_identifier'] || l.id,
      _maxQty: pending,
      _unitPrice: 0,
      _lineNetAmount: 0,
      _alreadyImported: sharedContext.alreadyAddedOrderLines?.has(l.id) || pending === 0,
    };
  });
};

const getDocDisplay = (doc) => ({ docNo: doc.documentNo || doc.id, date: doc.orderDate });

const buildLineBody = async ({ line, qty, invoiceId: shipmentId, lineNo }) => ({
  parentId: shipmentId,
  product: line.product,
  movementQuantity: qty,
  uOM: line.uOM || null,
  salesOrderLine: line.id,
  lineNo,
});

export default function ImportFromSalesOrderModal(props) {
  return (
    <ImportLinesModal
      {...props}
      linesEndpoint="goods-shipment/goodsShipmentLine"
      titleKey="importFromSalesOrder"
      searchPlaceholderKey="searchSalesOrder"
      emptyMessageKey="noCompletedSalesOrdersForThisCustomer"
      noSearchResultsKey="noOrdersMatchYourSearch"
      successMessageKey="linesImportedFromSalesOrder"
      showPriceColumns={false}
      fetchDocuments={fetchDocuments}
      fetchLines={fetchLines}
      getDocDisplay={getDocDisplay}
      buildLineBody={buildLineBody}
    />
  );
}

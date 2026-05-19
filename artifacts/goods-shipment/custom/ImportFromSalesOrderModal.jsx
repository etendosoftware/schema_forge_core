import ImportLinesModal from '@/components/contract-ui/ImportLinesModal';

const fetchDocuments = async ({ base, headers, bpId, invoiceId: shipmentId }) => {
  const [ordersRes, shipmentLinesRes] = await Promise.all([
    fetch(`${base}/sales-order/header?_startRow=0&_endRow=500&_sortBy=creationDate desc`, { headers }),
    fetch(`${base}/goods-shipment/goodsShipmentLine?parentId=${shipmentId}&_startRow=0&_endRow=200`, { headers }),
  ]);

  const alreadyAddedOrderLines = new Set();
  if (shipmentLinesRes.ok) {
    const existing = (await shipmentLinesRes.json())?.response?.data || [];
    existing.forEach(l => { if (l.orderLine) alreadyAddedOrderLines.add(l.orderLine); });
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
  return { documents, sharedContext: { alreadyAddedOrderLines } };
};

const fetchLines = async ({ base, headers, docId, sharedContext }) => {
  const res = await fetch(`${base}/sales-order/lines?parentId=${docId}&_startRow=0&_endRow=200`, { headers });
  if (!res.ok) return [];
  const lines = (await res.json())?.response?.data || [];
  return lines.map(l => {
    const ordered = Number(l.orderedQuantity) || 0;
    const delivered = Number(l.deliveredQuantity) || 0;
    const pending = Math.max(0, ordered - delivered);
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
  orderLine: line.id,
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

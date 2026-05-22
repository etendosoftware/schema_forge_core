import ImportLinesModal from '@/components/contract-ui/ImportLinesModal';

const fetchDocuments = async ({ base, headers, bpId }) => {
  const res = await fetch(
    `${base}/purchase-order/header?_startRow=0&_endRow=500&_sortBy=creationDate desc`,
    { headers },
  );
  let documents = [];
  if (res.ok) {
    const all = (await res.json())?.response?.data || [];
    documents = all.filter(o =>
      o.documentStatus === 'CO'
      && o.businessPartner === bpId
      && Number(o.deliveryStatusPurchase ?? 0) < 100
    );
  }
  return { documents, sharedContext: {} };
};

const fetchLines = async ({ base, headers, docId }) => {
  const res = await fetch(
    `${base}/purchase-order/lines?parentId=${docId}&_startRow=0&_endRow=200`,
    { headers },
  );
  if (!res.ok) return [];
  const lines = (await res.json())?.response?.data || [];
  return lines
    .map(l => {
      const ordered = Number(l.orderedQuantity) || 0;
      const delivered = Number(l.deliveredQuantity) || 0;
      const pending = Math.max(0, ordered - delivered);
      return {
        ...l,
        _productName: l['product$_identifier'] || l.id,
        _maxQty: pending,
        _orderedQty: ordered,
        _alreadyImported: pending <= 0,
      };
    })
    .filter(l => l._orderedQty > 0);
};

const getDocDisplay = (doc) => ({
  docNo: doc.documentNo || doc.id,
  date: doc.orderDate,
});

const buildLineBody = async ({ line, qty, invoiceId: receiptId, lineNo }) => ({
  parentId: receiptId,
  product: line.product,
  movementQuantity: qty,
  orderQuantity: Number(line.orderedQuantity) || qty,
  uOM: line.uOM || null,
  salesOrderLine: line.id,
  lineNo,
});

const afterImport = async ({ importedDocIds, base, headers, invoiceId }) => {
  if (importedDocIds.size !== 1) return;
  const [orderId] = importedDocIds;
  await fetch(`${base}/goods-receipt/goodsReceipt/${invoiceId}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ salesOrder: orderId }),
  });
};

export default function ImportFromPurchaseOrderModal(props) {
  return (
    <ImportLinesModal
      {...props}
      linesEndpoint="goods-receipt/goodsReceiptLine"
      titleKey="importFromPurchaseOrder"
      searchPlaceholderKey="searchPurchaseOrder"
      emptyMessageKey="noCompletedPurchaseOrdersWithPendingQuantitiesForThisVendor"
      noSearchResultsKey="noOrdersMatchYourSearch"
      successMessageKey="linesImportedFromPurchaseOrder"
      showPriceColumns={false}
      fetchDocuments={fetchDocuments}
      fetchLines={fetchLines}
      getDocDisplay={getDocDisplay}
      buildLineBody={buildLineBody}
      afterImport={afterImport}
    />
  );
}

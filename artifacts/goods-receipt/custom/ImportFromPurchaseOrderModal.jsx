import ImportLinesModal from '@/components/contract-ui/ImportLinesModal';

async function fetchDraftInfoByOrderLine({ base, headers, bpId, currentReceiptId }) {
  const res = await fetch(
    `${base}/goods-receipt/goodsReceipt?_startRow=0&_endRow=100&_sortBy=movementDate desc`,
    { headers },
  );
  if (!res.ok) return {};

  const all = (await res.json())?.response?.data || [];
  const currentDraft = all.find(s => s.id === currentReceiptId && s.documentStatus === 'DR');
  const otherDrafts = all.filter(s =>
    s.documentStatus === 'DR' && s.businessPartner === bpId && s.id !== currentReceiptId,
  );
  const toFetch = [...otherDrafts, ...(currentDraft ? [currentDraft] : [])];
  if (toFetch.length === 0) return {};

  const lineResults = await Promise.all(
    toFetch.map(s =>
      fetch(`${base}/goods-receipt/goodsReceiptLine?parentId=${s.id}&_startRow=0&_endRow=200`, { headers })
        .then(r => r.ok ? r.json().then(d => ({ receiptId: s.id, docNo: s.documentNo, lines: d?.response?.data || [] })) : null),
    ),
  );

  const draftInfo = {};
  for (const result of lineResults) {
    if (!result) continue;
    const isCurrent = result.receiptId === currentReceiptId;
    result.lines.forEach(l => {
      if (!l.salesOrderLine) return;
      if (!draftInfo[l.salesOrderLine]) draftInfo[l.salesOrderLine] = { qty: 0, docNos: new Set() };
      draftInfo[l.salesOrderLine].qty += Number(l.movementQuantity) || 0;
      if (!isCurrent) draftInfo[l.salesOrderLine].docNos.add(result.docNo);
    });
  }
  return draftInfo;
}

const fetchDocuments = async ({ base, headers, bpId, invoiceId: receiptId }) => {
  const [ordersRes, draftInfo] = await Promise.all([
    fetch(`${base}/purchase-order/header?_startRow=0&_endRow=500&_sortBy=creationDate desc`, { headers }),
    fetchDraftInfoByOrderLine({ base, headers, bpId, currentReceiptId: receiptId }),
  ]);
  let documents = [];
  if (ordersRes.ok) {
    const all = (await ordersRes.json())?.response?.data || [];
    documents = all.filter(o =>
      o.documentStatus === 'CO'
      && o.businessPartner === bpId
      && Number(o.deliveryStatusPurchase ?? 0) < 100
    );
  }
  return { documents, sharedContext: { draftInfo } };
};

const fetchLines = async ({ base, headers, docId, sharedContext }) => {
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
      const draftEntry = sharedContext.draftInfo?.[l.id];
      const inOtherDrafts = draftEntry?.qty || 0;
      const pending = Math.max(0, ordered - delivered - inOtherDrafts);
      return {
        ...l,
        _productName: l['product$_identifier'] || l.id,
        _maxQty: pending,
        _orderedQty: ordered,
        _alreadyImported: pending <= 0,
        _inDraftShipments: draftEntry?.docNos?.size ? [...draftEntry.docNos] : undefined,
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

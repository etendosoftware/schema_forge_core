import ImportLinesModal from '@/components/contract-ui/ImportLinesModal';

async function fetchDraftInfoByOrderLine({ base, headers, bpId, currentShipmentId }) {
  const res = await fetch(
    `${base}/goods-shipment/goodsShipment?_startRow=0&_endRow=100&_sortBy=movementDate desc`,
    { headers },
  );
  if (!res.ok) return {};

  const all = (await res.json())?.response?.data || [];
  const currentDraft = all.find(s => s.id === currentShipmentId && s.documentStatus === 'DR');
  const otherDrafts = all.filter(s =>
    s.documentStatus === 'DR' && s.businessPartner === bpId && s.id !== currentShipmentId,
  );
  const toFetch = [...otherDrafts, ...(currentDraft ? [currentDraft] : [])];
  if (toFetch.length === 0) return {};

  const lineResults = await Promise.all(
    toFetch.map(s =>
      fetch(`${base}/goods-shipment/goodsShipmentLine?parentId=${s.id}&_startRow=0&_endRow=200`, { headers })
        .then(r => r.ok ? r.json().then(d => ({ shipmentId: s.id, docNo: s.documentNo, lines: d?.response?.data || [] })) : null),
    ),
  );

  const draftInfo = {};
  for (const result of lineResults) {
    if (!result) continue;
    const isCurrent = result.shipmentId === currentShipmentId;
    result.lines.forEach(l => {
      if (!l.salesOrderLine) return;
      if (!draftInfo[l.salesOrderLine]) draftInfo[l.salesOrderLine] = { qty: 0, docNos: new Set() };
      draftInfo[l.salesOrderLine].qty += Number(l.movementQuantity) || 0;
      if (!isCurrent) draftInfo[l.salesOrderLine].docNos.add(result.docNo);
    });
  }
  return draftInfo;
}

const fetchDocuments = async ({ base, headers, bpId, invoiceId: shipmentId }) => {
  const [ordersRes, draftInfo] = await Promise.all([
    fetch(`${base}/sales-order/header?_startRow=0&_endRow=500&_sortBy=orderDate desc`, { headers }),
    fetchDraftInfoByOrderLine({ base, headers, bpId, currentShipmentId: shipmentId }),
  ]);

  let documents = [];
  if (ordersRes.ok) {
    const all = (await ordersRes.json())?.response?.data || [];
    documents = all.filter(o =>
      o.documentStatus === 'CO'
      && o.businessPartner === bpId
      && Number(o.deliveryStatus ?? 100) < 100,
    );
  }
  return { documents, sharedContext: { draftInfo } };
};

const fetchLines = async ({ base, headers, docId, sharedContext }) => {
  const res = await fetch(`${base}/sales-order/lines?parentId=${docId}&_startRow=0&_endRow=200`, { headers });
  if (!res.ok) return [];
  const lines = (await res.json())?.response?.data || [];
  return lines.map(l => {
    const ordered = Number(l.orderedQuantity) || 0;
    const delivered = Number(l.deliveredQuantity) || 0;
    const draftEntry = sharedContext.draftInfo?.[l.id];
    const inOtherDrafts = draftEntry?.qty || 0;
    const pending = Math.max(0, ordered - delivered - inOtherDrafts);
    return {
      ...l,
      _productName: l['product$_identifier'] || l.id,
      _maxQty: pending,
      _unitPrice: 0,
      _lineNetAmount: 0,
      _alreadyImported: pending === 0,
      _inDraftShipments: draftEntry?.docNos?.size ? [...draftEntry.docNos] : undefined,
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

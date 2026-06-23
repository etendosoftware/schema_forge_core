import ImportLinesModal from '@/components/contract-ui/ImportLinesModal';

const fetchDocuments = async ({ base, headers, bpId, invoiceId: receiptId }) => {
  const [ordersRes, receiptLinesRes] = await Promise.all([
    fetch(`${base}/purchase-order/header?_startRow=0&_endRow=500&_sortBy=orderDate desc`, { headers }),
    fetch(`${base}/goods-receipt/goodsReceiptLine?parentId=${receiptId}&_startRow=0&_endRow=300`, { headers }),
  ]);

  const importedQtyMap = {};
  let maxLineNo = 0;
  if (receiptLinesRes.ok) {
    const existingLines = (await receiptLinesRes.json())?.response?.data || [];
    existingLines.forEach(line => {
      const lineNo = Number(line.lineNo || line.line || 0) || 0;
      if (lineNo > maxLineNo) maxLineNo = lineNo;
      if (line.salesOrderLine) {
        importedQtyMap[line.salesOrderLine] =
          (importedQtyMap[line.salesOrderLine] || 0) + (Number(line.movementQuantity) || 0);
      }
    });
  }

  const allOrders = ordersRes.ok ? (await ordersRes.json())?.response?.data || [] : [];
  const documents = allOrders.filter(
    order => order.documentStatus === 'CO' && order.businessPartner === bpId,
  );

  return {
    documents,
    sharedContext: { importedQtyMap, nextLineNo: Math.max(10, maxLineNo + 10) },
  };
};

const fetchLines = async ({ base, headers, docId, sharedContext }) => {
  try {
    const res = await fetch(
      `${base}/purchase-order/lines?parentId=${docId}&_startRow=0&_endRow=300`,
      { headers },
    );
    if (!res.ok) return [];
    const lines = (await res.json())?.response?.data || [];
    const importedQtyMap = sharedContext?.importedQtyMap || {};
    return lines
      .filter(l => Number(l.orderedQuantity) > 0)
      .map(line => {
        const orderedQty = Number(line.orderedQuantity) || 0;
        const deliveredQty = Number(line.deliveredQuantity) || 0;
        const alreadyInReceipt = Number(importedQtyMap[line.id]) || 0;
        const availableQty = Math.max(orderedQty - deliveredQty - alreadyInReceipt, 0);
        return {
          ...line,
          _productName: line['product$_identifier'] || line.id,
          _maxQty: availableQty,
          _alreadyImported: availableQty <= 0,
          _lineNetAmount: Number(line.lineNetAmount) || 0,
        };
      });
  } catch {
    return [];
  }
};

const getDocDisplay = doc => ({
  docNo: doc.documentNo || doc.id,
  date: doc.orderDate,
  secondary:
    doc.grandTotalAmount != null
      ? Number(doc.grandTotalAmount).toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
      : undefined,
});

const buildLineBody = async ({ line, qty, invoiceId: receiptId, lineNo, sharedContext }) => ({
  parentId: receiptId,
  product: line.product,
  movementQuantity: qty,
  uOM: line.uOM || null,
  salesOrderLine: line.id,
  description: line.description || null,
  lineNo: (sharedContext?.nextLineNo ?? 10) + (lineNo - 10),
});

export default function ImportFromPurchaseOrderModal({ receiptId, ...rest }) {
  return (
    <ImportLinesModal
      {...rest}
      invoiceId={receiptId}
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
    />
  );
}

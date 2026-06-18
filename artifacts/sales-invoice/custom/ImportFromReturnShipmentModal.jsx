import ImportLinesModal from '@/components/contract-ui/ImportLinesModal';

/**
 * Import invoice lines from a completed Customer Return (Albarán de Devolución de Venta).
 * Available only for Factura de Devolución (DEV subtype) — enforced at the call site.
 *
 * Return lines already carry price and UOM, so no callout cascade is needed.
 * Already-imported detection uses the mInoutlineId field on invoice lines, which
 * stores the source M_InOut line ID regardless of whether it came from a standard
 * shipment or a customer return.
 */

const fetchDocuments = async ({ base, headers, bpId, invoiceId }) => {
  const [returnRes, invLinesRes] = await Promise.all([
    fetch(
      `${base}/return-from-customer/customerReturn?_startRow=0&_endRow=500&_sortBy=orderDate desc`,
      { headers },
    ),
    fetch(`${base}/sales-invoice/lines?parentId=${invoiceId}&_startRow=0&_endRow=200`, { headers }),
  ]);

  const alreadyImportedReturnLines = new Set();
  if (invLinesRes.ok) {
    const invLines = (await invLinesRes.json())?.response?.data || [];
    invLines.forEach(il => {
      if (il.mInoutlineId) alreadyImportedReturnLines.add(il.mInoutlineId);
    });
  }

  let documents = [];
  if (returnRes.ok) {
    const all = (await returnRes.json())?.response?.data || [];
    documents = all.filter(r => r.documentStatus === 'CO' && r.businessPartner === bpId);
  }

  return { documents, sharedContext: { alreadyImportedReturnLines } };
};

const fetchLines = async ({ base, headers, docId, sharedContext }) => {
  const res = await fetch(
    `${base}/return-from-customer/customerReturnLine?parentId=${docId}&_startRow=0&_endRow=200`,
    { headers },
  );
  if (!res.ok) return [];
  const json = await res.json();
  const lines = json?.response?.data || [];
  const { alreadyImportedReturnLines } = sharedContext;
  return lines.map(l => ({
    ...l,
    _productName: l['product$_identifier'] || l.id,
    _maxQty: Number(l.orderedQuantity) || 0,
    _unitPrice: Number(l.unitPrice) || 0,
    _lineNetAmount: Number(l.lineNetAmount) || 0,
    _alreadyImported: alreadyImportedReturnLines?.has(l.goodsShipmentLine) || false,
  }));
};

const getDocDisplay = (doc) => ({
  docNo: doc.documentNo || doc.id,
  date: doc.orderDate,
});

const buildLineBody = ({ line, qty, invoiceId, lineNo }) => {
  const unitPrice = Number(line.unitPrice) || 0;
  return {
    parentId: invoiceId,
    product: line.product,
    invoicedQuantity: qty,
    unitPrice,
    listPrice: unitPrice,
    lineNetAmount: qty * unitPrice,
    tax: line.tax || null,
    uOM: line.uOM || null,
    lineNo,
    mInoutlineId: line.goodsShipmentLine || null,
  };
};

export default function ImportFromReturnShipmentModal(props) {
  return (
    <ImportLinesModal
      {...props}
      linesEndpoint="sales-invoice/lines"
      titleKey="importFromReturnShipment"
      searchPlaceholderKey="searchReturnShipment"
      emptyMessageKey="noReturnShipmentsForCustomer"
      noSearchResultsKey="noReturnShipmentsMatchSearch"
      successMessageKey="linesImportedFromReturnShipment"
      showPriceColumns={false}
      fetchDocuments={fetchDocuments}
      fetchLines={fetchLines}
      getDocDisplay={getDocDisplay}
      buildLineBody={buildLineBody}
    />
  );
}

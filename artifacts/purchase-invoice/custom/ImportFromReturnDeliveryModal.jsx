import ImportLinesModal from '@/components/contract-ui/ImportLinesModal';

/**
 * Imports lines from a Purchase Return Delivery (return-to-vendor-shipment)
 * into a Return Material Purchase Invoice. Pricing is resolved via the
 * purchase-invoice lines callout, same as ImportFromGoodsReceiptModal.
 */

const resolveLinePrice = async (base, headers, productId, qty, invoiceHeader, auxData = {}) => {
  const formState = {
    ...invoiceHeader,
    ...auxData,
    product: productId,
    invoicedQuantity: qty || 1,
  };
  try {
    const res = await fetch(`${base}/purchase-invoice/lines/callout`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ field: 'product', value: productId, formState }),
    });
    if (!res.ok) return {};
    const data = await res.json();
    const result = {};
    if (data.updates) {
      for (const [k, entry] of Object.entries(data.updates)) result[k] = entry.value;
    }
    if (data.combos) {
      for (const [k, combo] of Object.entries(data.combos)) {
        if (combo.selected != null) result[k] = combo.selected;
      }
    }
    if (Number(result.standardPrice) && !Number(result.listPrice)) {
      result.listPrice = result.standardPrice;
    }
    const unitPrice = Number(result.unitPrice) || Number(result.grossUnitPrice) || 0;
    if (unitPrice) result.unitPrice = unitPrice;

    if (unitPrice) {
      const cascadeState = { ...formState, ...result, invoicedQuantity: qty || 1 };
      const cascadeRes = await fetch(`${base}/purchase-invoice/lines/callout`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ field: 'PriceActual', value: String(unitPrice), formState: cascadeState }),
      });
      if (cascadeRes.ok) {
        const cascadeData = await cascadeRes.json();
        if (cascadeData.updates) {
          for (const [k, entry] of Object.entries(cascadeData.updates)) result[k] = entry.value;
        }
        if (cascadeData.combos) {
          for (const [k, combo] of Object.entries(cascadeData.combos)) {
            if (combo.selected != null && !(k in result)) result[k] = combo.selected;
          }
        }
      }
    }
    return result;
  } catch {
    return {};
  }
};

const fetchDocuments = async ({ base, headers, bpId, invoiceId }) => {
  const [shipmentsRes, invLinesRes, headerRes] = await Promise.all([
    fetch(`${base}/return-to-vendor-shipment/returnToVendorShipment?_startRow=0&_endRow=500&_sortBy=creationDate desc`, { headers }),
    fetch(`${base}/purchase-invoice/lines?parentId=${invoiceId}&_startRow=0&_endRow=200`, { headers }),
    fetch(`${base}/purchase-invoice/header/${invoiceId}`, { headers }),
  ]);

  const alreadyImportedShipmentLines = new Set();
  if (invLinesRes.ok) {
    const invLines = (await invLinesRes.json())?.response?.data || [];
    invLines.forEach(il => {
      if (il.goodsShipmentLine) alreadyImportedShipmentLines.add(il.goodsShipmentLine);
    });
  }

  let invoiceHeader = {};
  if (headerRes.ok) {
    invoiceHeader = (await headerRes.json())?.response?.data?.[0] || {};
  }

  const priceListId = invoiceHeader.priceList;
  const selectorUrl = `${base}/purchase-invoice/lines/selectors/M_Product_ID?limit=500&offset=0${priceListId ? `&priceList=${encodeURIComponent(priceListId)}` : ''}`;
  const selectorRes = await fetch(selectorUrl, { headers });

  const productAuxMap = {};
  if (selectorRes.ok) {
    const selData = await selectorRes.json();
    for (const item of (selData?.items || [])) {
      if (item.id && item._aux) {
        const aux = {};
        for (const [suffix, val] of Object.entries(item._aux)) {
          aux[`product${suffix}`] = val;
        }
        productAuxMap[item.id] = aux;
      }
    }
  }

  let documents = [];
  if (shipmentsRes.ok) {
    const all = (await shipmentsRes.json())?.response?.data || [];
    documents = all.filter(r =>
      r.documentStatus === 'CO'
      && r.businessPartner === bpId
    );
  }

  return {
    documents,
    sharedContext: { invoiceHeader, productAuxMap, alreadyImportedShipmentLines },
  };
};

const fetchLines = async ({ base, headers, docId, sharedContext }) => {
  const res = await fetch(`${base}/return-to-vendor-shipment/returnToVendorShipmentLine?parentId=${docId}&_startRow=0&_endRow=200`, { headers });
  if (!res.ok) return [];
  const json = await res.json();
  const lines = json?.response?.data || [];
  const { invoiceHeader, productAuxMap, alreadyImportedShipmentLines } = sharedContext;

  return Promise.all(lines.map(async (l) => {
    const imported = alreadyImportedShipmentLines?.has(l.id);
    const qty = Number(l.movementQuantity) || 1;
    const priceData = l.product ? await resolveLinePrice(base, headers, l.product, qty, invoiceHeader, productAuxMap[l.product] || {}) : {};
    return {
      ...l,
      _productName: l['product$_identifier'] || l.id,
      _maxQty: Number(l.movementQuantity) || 0,
      _unitPrice: Number(priceData.unitPrice) || Number(priceData.grossUnitPrice) || 0,
      _lineNetAmount: Number(priceData.lineNetAmount ?? 0),
      _tax: priceData.tax || null,
      _uOM: priceData.uOM || l.uOM || null,
      _alreadyImported: !!imported,
    };
  }));
};

const getDocDisplay = (doc) => ({
  docNo: doc.documentNo || doc.id,
  date: doc.movementDate,
  secondary: doc.sourceReceiptDocNo ? `#${doc.sourceReceiptDocNo}` : '',
});

const buildLineBody = async ({ line, qty, invoiceId, lineNo, sharedContext, base, headers }) => {
  const { invoiceHeader, productAuxMap } = sharedContext;
  const priceData = await resolveLinePrice(base, headers, line.product, qty, invoiceHeader, productAuxMap[line.product] || {});
  const calloutGrossUnitPrice = Number(priceData.grossUnitPrice) || 0;
  const calloutUnitPrice = Number(priceData.unitPrice) || calloutGrossUnitPrice || Number(line._unitPrice) || 0;
  const listPrice = Number(priceData.listPrice) || calloutUnitPrice;
  const grossUnitPrice = (calloutGrossUnitPrice && calloutUnitPrice)
    ? calloutGrossUnitPrice * (calloutUnitPrice / calloutUnitPrice)
    : calloutGrossUnitPrice;

  const tax = priceData.tax || line._tax || null;
  const uOM = priceData.uOM || line._uOM || line.uOM || null;
  return {
    parentId: invoiceId,
    product: line.product,
    invoicedQuantity: qty,
    unitPrice: calloutUnitPrice,
    listPrice,
    ...(grossUnitPrice ? { grossUnitPrice } : {}),
    lineNetAmount: qty * calloutUnitPrice,
    tax,
    uOM,
    lineNo,
    goodsShipmentLine: line.id,
  };
};

export default function ImportFromReturnDeliveryModal(props) {
  return (
    <ImportLinesModal
      {...props}
      linesEndpoint="purchase-invoice/lines"
      titleKey="importFromReturnDelivery"
      searchPlaceholderKey="searchReturnDelivery"
      emptyMessageKey="noPendingReturnDeliveriesForSupplier"
      noSearchResultsKey="noReturnDeliveriesMatchYourSearch"
      successMessageKey="linesImportedFromReturnDelivery"
      showPriceColumns={false}
      fetchDocuments={fetchDocuments}
      fetchLines={fetchLines}
      getDocDisplay={getDocDisplay}
      buildLineBody={buildLineBody}
    />
  );
}

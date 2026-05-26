import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DocChip, RelatedDocumentsShell, docChipProps, fetchById } from '@/components/related-documents';
import { useUI } from '@/i18n';

export default function RelatedDocuments({ recordId, data, token, apiBaseUrl }) {
  const [sourceShipments, setSourceShipments] = useState([]);
  const [salesOrder, setSalesOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const navigate = useNavigate();
  const ui = useUI();

  useEffect(() => {
    if (!recordId || !data) { setLoading(false); return; }
    setLoading(true);
    const fetches = [];

    // sourceShipments is injected by ReturnMaterialReceiptHeaderHandler.afterHandle
    // as [{id, documentNo}] — one entry per unique source shipment.
    const shipmentsFromHandler = Array.isArray(data.sourceShipments) ? data.sourceShipments : [];

    if (shipmentsFromHandler.length > 0) {
      // Fetch full shipment records to get all fields needed by DocChip
      const shipmentFetches = shipmentsFromHandler.map(({ id }) =>
        fetchById('goods-shipment', 'goodsShipment', id, token, apiBaseUrl).catch(() => null)
      );
      fetches.push(
        Promise.all(shipmentFetches).then((results) =>
          setSourceShipments(results.filter(Boolean))
        )
      );
    } else {
      setSourceShipments([]);
    }

    const orderId = data.salesOrder;
    if (orderId) {
      fetches.push(
        fetchById('sales-order', 'header', orderId, token, apiBaseUrl)
          .then((o) => setSalesOrder(o))
          .catch(() => setSalesOrder(null))
      );
    } else {
      setSalesOrder(null);
    }

    Promise.all(fetches).finally(() => setLoading(false));
  }, [recordId, data, token, apiBaseUrl, refreshKey]);

  const chips = [];

  sourceShipments.forEach((shipment) => {
    chips.push(
      <DocChip
        key={`source-shipment-${shipment.id}`}
        {...docChipProps({ type: 'shipment', doc: shipment, ui, navigate })}
      />
    );
  });

  if (salesOrder) {
    chips.push(
      <DocChip
        key="sales-order"
        {...docChipProps({ type: 'sales-order', doc: salesOrder, ui, navigate })}
      />
    );
  }

  return (
    <RelatedDocumentsShell loading={loading} onRefresh={() => setRefreshKey((k) => k + 1)}>
      {chips}
    </RelatedDocumentsShell>
  );
}

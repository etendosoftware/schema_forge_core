import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DocChip, RelatedDocumentsShell, docChipProps, fetchByCriteria, fetchById } from '@/components/related-documents';
import { useUI } from '@/i18n';

export default function RelatedDocuments({ recordId, data, token, apiBaseUrl }) {
  const [sourceShipment, setSourceShipment] = useState(null);
  const [salesOrder, setSalesOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const navigate = useNavigate();
  const ui = useUI();

  useEffect(() => {
    if (!recordId || !data) { setLoading(false); return; }
    setLoading(true);

    const fetches = [];

    if (data.sourceShipmentDocNo) {
      fetches.push(
        fetchByCriteria('goods-shipment', 'goodsShipment', 'documentNo', data.sourceShipmentDocNo, token, apiBaseUrl)
          .then(rows => setSourceShipment(rows[0] ?? null))
      );
    } else {
      setSourceShipment(null);
    }

    const orderId = data.salesOrder;
    if (orderId) {
      fetches.push(
        fetchById('sales-order', 'header', orderId, token, apiBaseUrl)
          .then(o => setSalesOrder(o))
      );
    } else {
      setSalesOrder(null);
    }

    Promise.all(fetches).finally(() => setLoading(false));
  }, [recordId, data, token, apiBaseUrl, refreshKey]);

  const chips = [];

  if (sourceShipment) {
    chips.push(
      <DocChip
        key="source-shipment"
        {...docChipProps({ type: 'shipment', doc: sourceShipment, ui, navigate })}
      />
    );
  }

  if (salesOrder) {
    chips.push(
      <DocChip
        key="sales-order"
        {...docChipProps({ type: 'sales-order', doc: salesOrder, ui, navigate })}
      />
    );
  }

  return (
    <RelatedDocumentsShell loading={loading} onRefresh={() => setRefreshKey(k => k + 1)}>
      {chips}
    </RelatedDocumentsShell>
  );
}

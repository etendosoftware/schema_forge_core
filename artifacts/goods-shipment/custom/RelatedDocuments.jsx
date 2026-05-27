import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DocChip, RelatedDocumentsShell, STATUS_KEYS, CHIP_ICONS, CHIP_COLORS, docChipProps, fetchById } from '@/components/related-documents';
import { useUI } from '@/i18n';

export default function RelatedDocuments({ recordId, data, token, apiBaseUrl }) {
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const navigate = useNavigate();
  const ui = useUI();

  useEffect(() => {
    if (!recordId || !data) { setLoading(false); return; }
    setLoading(true);
    const orderId = data.salesOrder;
    if (!orderId) { setLoading(false); return; }

    fetchById('sales-order', 'header', orderId, token, apiBaseUrl).then(o => {
      setOrder(o);
      setLoading(false);
    });
  }, [recordId, data, token, apiBaseUrl, refreshKey]);

  const chips = [];

  if (order) {
    chips.push(
      <DocChip
        key="order"
        icon={CHIP_ICONS.order}
        iconColor={CHIP_COLORS.order}
        title={ui('orderDoc', { number: order.documentNo })}
        amount={order.grandTotalAmount}
        currency={order['currency$_identifier']}
        status={order.documentStatus}
        statusLabel={ui(STATUS_KEYS[order.documentStatus] || order.documentStatus)}
        onClick={() => navigate(`/sales-order/${order.id}`)}
      />
    );
  }

  const relatedInvoices = Array.isArray(data?.relatedInvoices) ? data.relatedInvoices : [];
  for (const inv of relatedInvoices) {
    chips.push(
      <DocChip
        key={`inv-${inv.id}`}
        icon={CHIP_ICONS.invoice}
        iconColor={CHIP_COLORS.invoice}
        title={ui('invoiceDoc', { number: inv.documentNo })}
        status={inv.documentStatus}
        statusLabel={ui(STATUS_KEYS[inv.documentStatus] || inv.documentStatus)}
        onClick={() => navigate(`/sales-invoice/${inv.id}`)}
      />
    );
  }

  const returnReceipts = Array.isArray(data?.returnReceipts) ? data.returnReceipts : [];
  for (const ret of returnReceipts) {
    chips.push(
      <DocChip
        key={`return-${ret.id}`}
        {...docChipProps({ type: 'return-material-receipt', doc: ret, ui, navigate })}
      />
    );
  }

  return (
    <RelatedDocumentsShell loading={loading} onRefresh={() => setRefreshKey(k => k + 1)}>
      {chips}
    </RelatedDocumentsShell>
  );
}

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DocChip, RelatedDocumentsShell, STATUS_KEYS, CHIP_ICONS, CHIP_COLORS, fetchById } from '@/components/related-documents';
import { useUI } from '@/i18n';

export default function RelatedDocuments({ recordId, data, token, apiBaseUrl }) {
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const ui = useUI();

  useEffect(() => {
    if (!recordId || !data) { setLoading(false); return; }
    const orderId = data.salesOrder;
    if (!orderId) { setLoading(false); return; }

    fetchById('sales-order', 'header', orderId, token, apiBaseUrl)
      .then((o) => {
        setOrder(o);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [recordId, data, token, apiBaseUrl]);

  return (
    <RelatedDocumentsShell loading={loading}>
      {order && (
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
      )}
    </RelatedDocumentsShell>
  );
}

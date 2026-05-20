import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DocChip, RelatedDocumentsShell, docChipProps, fetchByCriteria } from '@/components/related-documents';
import { useUI } from '@/i18n';

export default function RelatedDocuments({ recordId, data, token, apiBaseUrl }) {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const navigate = useNavigate();
  const ui = useUI();

  useEffect(() => {
    if (!recordId) return;
    setLoading(true);
    const orderId = data?.salesOrder;
    if (orderId) {
      fetchByCriteria('purchase-invoice', 'header', 'salesOrder', orderId, token, apiBaseUrl)
        .then(rows => setInvoices(rows))
        .finally(() => setLoading(false));
    } else {
      setInvoices([]);
      setLoading(false);
    }
  }, [recordId, data?.salesOrder, token, apiBaseUrl, refreshKey]);

  const chips = [];

  // Purchase Order from header data
  const orderId = data?.salesOrder;
  const orderLabel = data?.['salesOrder$_identifier'];
  if (orderId) {
    chips.push(
      <DocChip
        key="purchase-order"
        {...docChipProps({
          type: 'order',
          doc: { id: orderId, documentNo: orderLabel },
          ui,
          navigate,
        })}
      />
    );
  }

  for (const inv of invoices) {
    chips.push(
      <DocChip key={`invoice-${inv.id}`} {...docChipProps({ type: 'invoice', doc: inv, ui, navigate })} />
    );
  }

  return (
    <RelatedDocumentsShell loading={loading} onRefresh={() => setRefreshKey(k => k + 1)}>
      {chips}
    </RelatedDocumentsShell>
  );
}

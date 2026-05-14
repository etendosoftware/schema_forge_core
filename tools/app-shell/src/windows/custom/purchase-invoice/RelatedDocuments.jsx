import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUI } from '@/i18n';
import {
  DocChip, RelatedDocumentsShell, docChipProps,
  fetchByCriteria, fetchChild, fetchById,
} from '@/components/related-documents';

async function fetchPayments(invoiceId, token, apiBaseUrl) {
  const plans = await fetchChild('purchase-invoice', 'paymentPlan', invoiceId, token, apiBaseUrl);
  if (plans.length === 0) return [];
  const detailResults = await Promise.all(
    plans.map(plan => fetchChild('purchase-invoice', 'paymentDetails', plan.id, token, apiBaseUrl))
  );
  const seen = new Set();
  const paymentIds = detailResults.flat()
    .filter(d => d.payment && !seen.has(d.payment))
    .map(d => { seen.add(d.payment); return d.payment; });
  if (paymentIds.length === 0) return [];
  const results = await Promise.all(
    paymentIds.map(id => fetchById('payment-out', 'finPayment', id, token, apiBaseUrl))
  );
  return results.filter(Boolean);
}

export default function RelatedDocuments({ recordId, data, token, apiBaseUrl }) {
  const [purchaseOrder, setPurchaseOrder] = useState(null);
  const [receipts, setReceipts] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const navigate = useNavigate();
  const ui = useUI();

  useEffect(() => {
    if (!recordId) return;
    setLoading(true);
    const orderId = data?.salesOrder;
    const orderPromise = orderId
      ? fetchById('purchase-order', 'header', orderId, token, apiBaseUrl).catch(() => null)
      : Promise.resolve(null);
    const receiptPromise = orderId
      ? fetchByCriteria('goods-receipt', 'goodsReceipt', 'salesOrder', orderId, token, apiBaseUrl)
      : Promise.resolve([]);
    Promise.all([orderPromise, receiptPromise, fetchPayments(recordId, token, apiBaseUrl)])
      .then(([orderResult, receiptRows, paymentResults]) => {
        setPurchaseOrder(orderResult);
        setReceipts(receiptRows);
        setPayments(paymentResults);
      })
      .finally(() => setLoading(false));
  }, [recordId, data?.salesOrder, token, apiBaseUrl, refreshKey]);

  const chips = [];

  if (purchaseOrder) {
    chips.push(
      <DocChip key="purchase-order" {...docChipProps({ type: 'order', doc: purchaseOrder, ui, navigate })} />
    );
  }

  for (const r of receipts) {
    chips.push(
      <DocChip key={`receipt-${r.id}`} {...docChipProps({ type: 'receipt', doc: r, ui, navigate })} />
    );
  }

  for (const p of payments) {
    chips.push(
      <DocChip key={`payment-${p.id}`} {...docChipProps({ type: 'payment', doc: p, ui, navigate })} />
    );
  }

  return (
    <RelatedDocumentsShell loading={loading} onRefresh={() => setRefreshKey(k => k + 1)}>
      {chips}
    </RelatedDocumentsShell>
  );
}

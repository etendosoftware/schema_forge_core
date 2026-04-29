import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUI } from '@/i18n';
import {
  DocChip,
  RelatedDocumentsShell,
  STATUS_KEYS,
  CHIP_ICONS,
  CHIP_COLORS,
  fetchByCriteria,
  fetchChild,
  neoBase,
} from '@/components/related-documents';

async function fetchPayments(orderId, token, apiBaseUrl) {
  const plans = await fetchChild('sales-order', 'Payment Plan', orderId, token, apiBaseUrl);
  if (plans.length === 0) return [];
  const detailResults = await Promise.all(
    plans.map(plan => fetchChild('sales-order', 'Payment Details', plan.id, token, apiBaseUrl))
  );
  const paymentIds = [...new Set(
    detailResults.flat().filter(d => d.payment).map(d => d.payment)
  )];
  if (paymentIds.length === 0) return [];
  const base = neoBase(apiBaseUrl);
  const results = await Promise.all(paymentIds.map(id =>
    fetch(`${base}/payment-in/finPayment/${id}`, {
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    })
      .then(r => r.ok ? r.json() : null)
      .then(j => j?.response?.data?.[0] || null)
      .catch(() => null)
  ));
  return results.filter(Boolean);
}

export default function RelatedDocuments({ recordId, data, token, apiBaseUrl }) {
  const ui = useUI();
  const [related, setRelated] = useState({});
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const navigate = useNavigate();
  // Track the last recordId we actually fetched related docs for. Without this,
  // the effect re-fires during the /new → /:id transition (because `data` mutates
  // as the hook primes the saved record) and we issue duplicate goods-shipment,
  // listInvoices, and Payment Plan requests.
  // See docs/plans/sales-order-save-performance.md (Etapa 1.3).
  const lastFetchedIdRef = useRef(null);

  // Listen for doc creation events from OrderCreateInvoice
  useEffect(() => {
    const handler = () => setRefreshKey(k => k + 1);
    window.addEventListener('sales-order:document-created', handler);
    return () => window.removeEventListener('sales-order:document-created', handler);
  }, []);

  // Reset the guard on explicit refresh (e.g. OrderCreateInvoice event).
  useEffect(() => {
    lastFetchedIdRef.current = null;
  }, [refreshKey]);

  useEffect(() => {
    if (!recordId || recordId === 'new') {
      setLoading(false);
      return;
    }
    if (lastFetchedIdRef.current === recordId) return;
    lastFetchedIdRef.current = recordId;
    setLoading(true);

    // Shipments via criteria; invoices via listInvoices action (finds all, even when C_Order_ID is null)
    const shipmentPromise = fetchByCriteria('goods-shipment', 'goodsShipment', 'salesOrder', recordId, token, apiBaseUrl);
    const invoicePromise = fetch(
      `${apiBaseUrl}/header/${recordId}/action/listInvoices`,
      { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } },
    )
      .then(r => r.ok ? r.json() : null)
      .then(j => j?.response?.data ?? [])
      .catch(() => []);

    Promise.all([shipmentPromise, invoicePromise, fetchPayments(recordId, token, apiBaseUrl)])
      .then(([shipments, invoices, paymentResults]) => {
        setRelated({
          'goods-shipment': shipments,
          'sales-invoice': invoices,
        });
        setPayments(paymentResults);
        setLoading(false);
      });
  }, [recordId, token, apiBaseUrl, refreshKey]);

  const refreshBtn = (
    <button
      type="button"
      onClick={() => setRefreshKey(k => k + 1)}
      title={ui('refresh')}
      className="inline-flex items-center justify-center w-5 h-5 rounded text-muted-foreground/50 hover:text-muted-foreground transition-colors"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`}>
        <path d="M23 4v6h-6" /><path d="M1 20v-6h6" />
        <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
      </svg>
    </button>
  );

  if (loading) {
    return <RelatedDocumentsShell loading />;
  }

  const chips = [];

  const quotationId = data?.quotation;
  const quotationLabel = data?.['quotation$_identifier'];
  if (quotationId) {
    // Parse backend _identifier: "1000373 - 07-04-2026 - 191.80"
    let qNumber = quotationLabel ? quotationLabel.split(' - ')[0].trim() : quotationId;
    let qAmount = null;
    if (quotationLabel) {
      const parts = quotationLabel.split(' - ');
      if (parts.length >= 3) qAmount = parseFloat(parts[2].trim()) || null;
    }
    chips.push(
      <DocChip
        key="quotation"
        icon={CHIP_ICONS.quotation}
        iconColor={CHIP_COLORS.quotation}
        title={ui('quotationDoc', { number: qNumber })}
        amount={qAmount}
        currency={data?.['currency$_identifier']}
        status="CO"
        statusLabel={ui(STATUS_KEYS.CO)}
        onClick={() => navigate(`/sales-quotation/${quotationId}`)}
      />
    );
  }

  for (const row of (related['goods-shipment'] || [])) {
    chips.push(
      <DocChip
        key={`shipment-${row.id}`}
        icon={CHIP_ICONS.shipment}
        iconColor={CHIP_COLORS.shipment}
        title={ui('shipmentDoc', { number: row.documentNo })}
        status={row.documentStatus}
        statusLabel={ui(STATUS_KEYS[row.documentStatus] || row.documentStatus)}
        onClick={() => navigate(`/goods-shipment/${row.id}`)}
      />
    );
  }

  for (const row of (related['sales-invoice'] || [])) {
    chips.push(
      <DocChip
        key={`invoice-${row.id}`}
        icon={CHIP_ICONS.invoice}
        iconColor={CHIP_COLORS.invoice}
        title={ui('invoiceDoc', { number: row.documentNo })}
        amount={row.grandTotalAmount}
        currency={row['currency$_identifier']}
        status={row.documentStatus}
        statusLabel={ui(STATUS_KEYS[row.documentStatus] || row.documentStatus)}
        onClick={() => navigate(`/sales-invoice/${row.id}`)}
      />
    );
  }

  for (const p of payments) {
    chips.push(
      <DocChip
        key={`payment-${p.id}`}
        icon={CHIP_ICONS.payment}
        iconColor={CHIP_COLORS.payment}
        title={ui('paymentDoc', { number: p.documentNo || p.id })}
        amount={p.amount}
        currency={p['currency$_identifier']}
        status={p.status}
        statusLabel={ui(STATUS_KEYS[p.status] || p.status)}
        onClick={() => navigate(`/payment-in/${p.id}`)}
      />
    );
  }

  if (chips.length === 0) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground/50">{ui('noRelatedDocuments')}</span>
        {refreshBtn}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {chips}
      {refreshBtn}
    </div>
  );
}

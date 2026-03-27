import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const STATUS_LABELS = {
  CO: 'Completed', DR: 'Draft', VO: 'Voided', CL: 'Closed',
};
const STATUS_COLORS = {
  CO: 'bg-emerald-500', CL: 'bg-emerald-500', DR: 'bg-gray-400', VO: 'bg-red-400',
};

function StatusDot({ value }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground min-w-[80px]">
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_COLORS[value] || 'bg-gray-400'}`} />
      {STATUS_LABELS[value] || value}
    </span>
  );
}

function formatDate(val) {
  if (!val) return '';
  return new Date(val).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatAmount(val) {
  if (val == null) return '';
  const num = typeof val === 'string' ? parseFloat(val) : val;
  return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function neoBase(apiBaseUrl) {
  return (apiBaseUrl || '').replace(/\/[^/]+$/, '');
}

export default function RelatedDocuments({ recordId, data, token, apiBaseUrl }) {
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!recordId || !data) { setLoading(false); return; }
    // The shipment's salesOrder field contains the C_Order_ID
    const orderId = data.salesOrder;
    if (!orderId) { setLoading(false); return; }

    const base = neoBase(apiBaseUrl);
    fetch(`${base}/sales-order/order/${orderId}`, {
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    })
      .then(r => r.ok ? r.json() : null)
      .then(j => {
        const row = j?.response?.data?.[0] || j?.response?.data || null;
        setOrder(row);
        setLoading(false);
      })
      .catch(() => { setOrder(null); setLoading(false); });
  }, [recordId, data, token, apiBaseUrl]);

  if (loading) return <div className="text-xs text-muted-foreground py-3 px-3">Loading...</div>;
  if (!order) return null;

  return (
    <div className="max-w-3xl">
      <div className="space-y-0.5">
        <div className="flex items-center gap-2 px-3 py-1.5">
          <svg className="w-4 h-4 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
            <rect x="9" y="3" width="6" height="4" rx="1" />
          </svg>
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Sales Order</span>
        </div>
        <div
          onClick={() => navigate(`/sales-order/${order.id}`)}
          className="flex items-center justify-between py-2.5 px-3 rounded-md hover:bg-muted/50 cursor-pointer transition-colors group"
        >
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-sm font-medium text-blue-600 group-hover:underline">#{order.documentNo}</span>
            <span className="text-xs text-muted-foreground">{formatDate(order.orderDate)}</span>
          </div>
          <div className="flex items-center gap-4 shrink-0">
            {order.grandTotalAmount != null && (
              <span className="text-sm font-medium tabular-nums">{formatAmount(order.grandTotalAmount)}</span>
            )}
            {order.documentStatus && <StatusDot value={order.documentStatus} />}
          </div>
        </div>
      </div>
    </div>
  );
}

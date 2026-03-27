import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { buildUrlWithParams } from '@/lib/buildUrlWithParams.js';

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
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!recordId) return;
    setLoading(true);
    const base = neoBase(apiBaseUrl);
    const criteria = JSON.stringify([{ fieldName: 'quotation', operator: 'equals', value: recordId }]);
    const params = new URLSearchParams({ criteria, _limit: '50' });
    fetch(`${base}/sales-order/order?${params}`, {
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    })
      .then(r => r.ok ? r.json() : { response: { data: [] } })
      .then(j => { setOrders(j.response?.data || []); setLoading(false); })
      .catch(() => { setOrders([]); setLoading(false); });
  }, [recordId, token, apiBaseUrl]);

  if (loading) return <div className="text-xs text-muted-foreground py-3 px-3">Loading...</div>;
  if (orders.length === 0) return null;

  return (
    <div className="max-w-3xl">
      <div className="space-y-0.5">
        <div className="flex items-center gap-2 px-3 py-1.5">
          <svg className="w-4 h-4 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
            <rect x="9" y="3" width="6" height="4" rx="1" />
          </svg>
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Sales Orders</span>
          <span className="text-xs text-muted-foreground/60">{orders.length}</span>
        </div>
        {orders.map((row, i) => (
          <div
            key={row.id || i}
            onClick={() => navigate(`/sales-order/${row.id}`)}
            className="flex items-center justify-between py-2.5 px-3 rounded-md hover:bg-muted/50 cursor-pointer transition-colors group"
          >
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-sm font-medium text-blue-600 group-hover:underline">#{row.documentNo}</span>
              <span className="text-xs text-muted-foreground">{formatDate(row.orderDate)}</span>
            </div>
            <div className="flex items-center gap-4 shrink-0">
              {row.grandTotalAmount != null && (
                <span className="text-sm font-medium tabular-nums">{formatAmount(row.grandTotalAmount)}</span>
              )}
              {row.documentStatus && <StatusDot value={row.documentStatus} />}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

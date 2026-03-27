import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const STATUS_LABELS = {
  CO: 'Completed', DR: 'Draft', VO: 'Voided', CL: 'Closed',
  RPPC: 'Received', RPR: 'Received', PWNC: 'Pending', RDNC: 'Deposited',
};

const STATUS_COLORS = {
  CO: 'bg-emerald-500', CL: 'bg-emerald-500', RPPC: 'bg-emerald-500', RPR: 'bg-emerald-500', RDNC: 'bg-emerald-500',
  DR: 'bg-gray-400', PWNC: 'bg-amber-400', VO: 'bg-red-400',
};

const ICONS = {
  shipments: (
    <svg className="w-4 h-4 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M20 21v-2a4 4 0 00-3-3.87M9 7a4 4 0 01-4 4H3l3 7h12l3-7h-2a4 4 0 01-4-4V3H9v4z" />
      <rect x="1" y="3" width="22" height="5" rx="1" />
      <path d="M1 8l2 13h18l2-13" />
    </svg>
  ),
  invoices: (
    <svg className="w-4 h-4 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <path d="M14 2v6h6M8 13h8M8 17h8M8 9h2" />
    </svg>
  ),
  payments: (
    <svg className="w-4 h-4 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="12" cy="12" r="10" />
      <path d="M16 8h-4a2 2 0 100 4h2a2 2 0 110 4H8M12 6v2m0 8v2" />
    </svg>
  ),
  quotation: (
    <svg className="w-4 h-4 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
      <rect x="9" y="3" width="6" height="4" rx="1" />
      <path d="M9 14l2 2 4-4" />
    </svg>
  ),
};

const RELATED_SPECS = [
  {
    key: 'goods-shipment',
    label: 'Shipments',
    icon: 'shipments',
    specName: 'goods-shipment',
    entityName: 'goodsShipment',
    filterColumn: 'salesOrder',
    route: '/goods-shipment',
    format: (row) => ({
      title: `#${row.documentNo}`,
      date: row.movementDate,
      status: row.documentStatus,
    }),
  },
  {
    key: 'sales-invoice',
    label: 'Invoices',
    icon: 'invoices',
    specName: 'sales-invoice',
    entityName: 'invoice',
    filterColumn: 'salesOrder',
    route: '/sales-invoice',
    format: (row) => ({
      title: `#${row.documentNo}`,
      date: row.invoiceDate,
      amount: row.grandTotalAmount,
      currency: row['currency$_identifier'],
      status: row.documentStatus,
    }),
  },
];

function neoBase(apiBaseUrl) {
  return (apiBaseUrl || '').replace(/\/[^/]+$/, '');
}

function fetchByCriteria(specName, entityName, fieldName, value, token, apiBaseUrl) {
  const base = neoBase(apiBaseUrl);
  const criteria = JSON.stringify([{ fieldName, operator: 'equals', value }]);
  const params = new URLSearchParams({ criteria, _limit: '50' });
  return fetch(`${base}/${specName}/${entityName}?${params}`, {
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
  })
    .then(r => r.ok ? r.json() : { response: { data: [] } })
    .then(j => j.response?.data || [])
    .catch(() => []);
}

function fetchChild(specName, entityName, parentId, token, apiBaseUrl) {
  const base = neoBase(apiBaseUrl);
  return fetch(`${base}/${specName}/${encodeURIComponent(entityName)}?parentId=${parentId}&_limit=50`, {
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
  })
    .then(r => r.ok ? r.json() : { response: { data: [] } })
    .then(j => j.response?.data || [])
    .catch(() => []);
}

async function fetchPayments(orderId, token, apiBaseUrl) {
  const plans = await fetchChild('sales-order', 'Payment Plan', orderId, token, apiBaseUrl);
  if (plans.length === 0) return [];
  const detailResults = await Promise.all(
    plans.map(plan => fetchChild('sales-order', 'Payment Details', plan.id, token, apiBaseUrl))
  );
  const seen = new Set();
  const paymentIds = detailResults.flat()
    .filter(d => d.payment && !seen.has(d.payment))
    .map(d => { seen.add(d.payment); return d.payment; });
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

function formatAmount(val, currency) {
  if (val == null) return '';
  const num = typeof val === 'string' ? parseFloat(val) : val;
  const formatted = num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return currency ? `${formatted} ${currency}` : formatted;
}

function formatDate(val) {
  if (!val) return '';
  return new Date(val).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

function DocRow({ title, date, amount, currency, status, onClick }) {
  return (
    <div
      onClick={onClick}
      className="flex items-center justify-between py-2.5 px-3 rounded-md hover:bg-muted/50 cursor-pointer transition-colors group"
    >
      <div className="flex items-center gap-3 min-w-0">
        <span className="text-sm font-medium text-blue-600 group-hover:underline">{title}</span>
        <span className="text-xs text-muted-foreground">{formatDate(date)}</span>
      </div>
      <div className="flex items-center gap-4 shrink-0">
        {amount != null && (
          <span className="text-sm font-medium tabular-nums">{formatAmount(amount, currency)}</span>
        )}
        {status && (
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground min-w-[80px]">
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_COLORS[status] || 'bg-gray-400'}`} />
            {STATUS_LABELS[status] || status}
          </span>
        )}
      </div>
    </div>
  );
}

function Section({ icon, label, count, children }) {
  return (
    <div className="space-y-0.5">
      <div className="flex items-center gap-2 px-3 py-1.5">
        {ICONS[icon]}
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</span>
        <span className="text-xs text-muted-foreground/60">{count}</span>
      </div>
      {count === 0 ? (
        <p className="text-xs text-muted-foreground/50 px-3 py-1">No records</p>
      ) : (
        <div>{children}</div>
      )}
    </div>
  );
}

export default function RelatedDocuments({ recordId, data, token, apiBaseUrl }) {
  const [related, setRelated] = useState({});
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!recordId) return;
    setLoading(true);
    const specPromises = RELATED_SPECS.map(s =>
      fetchByCriteria(s.specName, s.entityName, s.filterColumn, recordId, token, apiBaseUrl)
        .then(rows => ({ key: s.key, rows }))
    );
    Promise.all([Promise.all(specPromises), fetchPayments(recordId, token, apiBaseUrl)])
      .then(([specResults, paymentResults]) => {
        const map = {};
        for (const r of specResults) map[r.key] = r.rows;
        setRelated(map);
        setPayments(paymentResults);
        setLoading(false);
      });
  }, [recordId, token, apiBaseUrl]);

  if (loading) {
    return <div className="text-xs text-muted-foreground py-3 px-3">Loading...</div>;
  }

  const quotationId = data?.quotation;
  const quotationLabel = data?.['quotation$_identifier'];

  const sections = [];

  if (quotationId) {
    sections.push(
      <Section key="quotation" icon="quotation" label="Quotation" count={1}>
        <DocRow
          title={quotationLabel || quotationId}
          onClick={() => navigate(`/sales-quotation/${quotationId}`)}
        />
      </Section>
    );
  }

  for (const spec of RELATED_SPECS) {
    const rows = related[spec.key] || [];
    if (rows.length > 0) {
      sections.push(
        <Section key={spec.key} icon={spec.icon} label={spec.label} count={rows.length}>
          {rows.map((row, i) => {
            const f = spec.format(row);
            return (
              <DocRow
                key={row.id || i}
                title={f.title}
                date={f.date}
                amount={f.amount}
                currency={f.currency}
                status={f.status}
                onClick={() => navigate(`${spec.route}/${row.id}`)}
              />
            );
          })}
        </Section>
      );
    }
  }

  if (payments.length > 0) {
    sections.push(
      <Section key="payments" icon="payments" label="Payments" count={payments.length}>
        {payments.map((p, i) => (
          <DocRow
            key={p.id || i}
            title={`#${p.documentNo || p.id}`}
            date={p.paymentDate}
            amount={p.amount}
            currency={p['currency$_identifier']}
            status={p.status}
            onClick={() => navigate(`/payment-in/${p.id}`)}
          />
        ))}
      </Section>
    );
  }

  if (sections.length === 0) return null;

  return (
    <div className="max-w-3xl divide-y divide-border/30">
      {sections}
    </div>
  );
}

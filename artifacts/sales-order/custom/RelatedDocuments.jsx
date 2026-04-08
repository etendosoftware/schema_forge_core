import { useState, useEffect } from 'react';
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
  fetchById,
} from '@/components/related-documents';

const RELATED_SPECS = [
  {
    key: 'goods-shipment',
    icon: 'shipment',
    specName: 'goods-shipment',
    entityName: 'goodsShipment',
    filterColumn: 'salesOrder',
    route: '/goods-shipment',
    titleKey: 'shipmentDoc',
    format: (row) => ({
      docNo: row.documentNo,
      date: row.movementDate,
      status: row.documentStatus,
    }),
  },
  {
    key: 'sales-invoice',
    icon: 'invoice',
    specName: 'sales-invoice',
    entityName: 'invoice',
    filterColumn: 'salesOrder',
    route: '/sales-invoice',
    titleKey: 'invoiceDoc',
    format: (row) => ({
      docNo: row.documentNo,
      date: row.invoiceDate,
      amount: row.grandTotalAmount,
      currency: row['currency$_identifier'],
      status: row.documentStatus,
    }),
  },
];

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
  const results = await Promise.all(
    paymentIds.map(id => fetchById('payment-in', 'finPayment', id, token, apiBaseUrl))
  );
  return results.filter(Boolean);
}

export default function RelatedDocuments({ recordId, data, token, apiBaseUrl }) {
  const [related, setRelated] = useState({});
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const ui = useUI();

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

  const chips = [];

  const quotationId = data?.quotation;
  const quotationLabel = data?.['quotation$_identifier'];
  if (quotationId) {
    let qTitle = ui('quotation');
    let qAmount = null;
    const qStatus = 'CO';
    if (quotationLabel) {
      const parts = quotationLabel.split(' - ');
      if (parts.length >= 1) qTitle = ui('quotationDoc', { number: parts[0].trim() });
      if (parts.length >= 3) qAmount = parseFloat(parts[2].trim()) || null;
    }
    chips.push(
      <DocChip
        key="quotation"
        icon={CHIP_ICONS.quotation}
        iconColor={CHIP_COLORS.quotation}
        title={qTitle}
        amount={qAmount}
        currency={data?.['currency$_identifier']}
        status={qStatus}
        statusLabel={ui(STATUS_KEYS[qStatus] || qStatus)}
        onClick={() => navigate(`/sales-quotation/${quotationId}`)}
      />
    );
  }

  for (const spec of RELATED_SPECS) {
    const rows = related[spec.key] || [];
    for (const row of rows) {
      const f = spec.format(row);
      chips.push(
        <DocChip
          key={`${spec.key}-${row.id}`}
          icon={CHIP_ICONS[spec.icon]}
          iconColor={CHIP_COLORS[spec.icon]}
          title={ui(spec.titleKey, { number: f.docNo })}
          amount={f.amount}
          currency={f.currency}
          status={f.status}
          statusLabel={ui(STATUS_KEYS[f.status] || f.status)}
          onClick={() => navigate(`${spec.route}/${row.id}`)}
        />
      );
    }
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

  return (
    <RelatedDocumentsShell loading={loading}>
      {chips}
    </RelatedDocumentsShell>
  );
}

import { useState, useMemo, useEffect } from 'react';
import { DataTable } from '@/components/contract-ui';
import { useLocale } from '@/i18n';

/* eslint-disable react/prop-types */

const filters = ['documentNo', 'invoiceDate', 'businessPartner', 'orderReference', 'documentStatus'];

export default function PurchaseInvoiceHeaderTable(props) {
  const dictionary = useLocale();
  const gl = dictionary?.genericLabels || {};
  const t = (key) => gl[key] || key;

  // ─── Batch-fetch max dueDate per invoice from payment plan ────
  const [dueDates, setDueDates] = useState({});
  useEffect(() => {
    const rows = props.data;
    if (!rows?.length || !props.apiBaseUrl || !props.token) return;
    const headers = { Authorization: `Bearer ${props.token}` };
    const ids = rows.map(r => r.id).filter(Boolean);
    Promise.all(
      ids.map(id =>
        fetch(`${props.apiBaseUrl}/paymentPlan?parentId=${id}`, { headers })
          .then(r => r.ok ? r.json() : {})
          .then(d => {
            const installments = d?.response?.data ?? d?.data ?? [];
            const timestamps = installments
              .map(i => i.dueDate ? new Date(i.dueDate).getTime() : NaN)
              .filter(ts => !Number.isNaN(ts));
            return [id, timestamps.length > 0 ? new Date(Math.max(...timestamps)) : null];
          })
          .catch(() => [id, null])
      )
    ).then(entries => setDueDates(Object.fromEntries(entries)));
  }, [props.data, props.apiBaseUrl, props.token]);

  const columns = useMemo(() => [
    { key: 'invoiceDate', column: 'DateInvoiced', type: 'date', dot: false },
    { key: 'orderReference', column: 'POReference', type: 'string' },
    {
      key: '_dueDate', column: '_dueDate', type: 'custom', label: t('dueDate'),
      render: (row) => {
        const d = dueDates[row.id];
        if (!d) return <span className="text-muted-foreground">—</span>;
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const due = new Date(d); due.setHours(0, 0, 0, 0);
        const dotColor = due < today ? 'bg-red-500' : 'bg-emerald-500';
        return (
          <span className="inline-flex items-center gap-1.5">
            <span className={`inline-block h-2 w-2 rounded-full shrink-0 ${dotColor}`} />
            {d.toLocaleDateString('en-GB')}
          </span>
        );
      },
    },
    { key: 'businessPartner', column: 'C_BPartner_ID', type: 'selector' },
    { key: 'documentStatus', column: 'DocStatus', type: 'status' },
    { key: 'grandTotalAmount', column: 'GrandTotal', type: 'amount' },
    { key: 'outstandingAmount', column: 'OutstandingAmt', type: 'amount' },
  ], [gl, dueDates]);

  return <DataTable columns={columns} filters={filters} {...props} />;
}

import { useState, useMemo, useEffect } from 'react';
import { DataTable } from '@/components/contract-ui';
import { useLocale, useLocaleSwitch } from '@/i18n';
import { formatCalendarDate } from '@/lib/dateOnly';
import { getDueDateDotColor, getLatestInstallmentDueDate } from '@/lib/invoiceDueDate';

/* eslint-disable react/prop-types */

const filters = ['documentNo', 'invoiceDate', 'businessPartner', 'orderReference', 'documentStatus'];

export default function PurchaseInvoiceHeaderTable(props) {
  const dictionary = useLocale();
  const { locale } = useLocaleSwitch();
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
            return [id, getLatestInstallmentDueDate(installments)];
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
        const dotColor = getDueDateDotColor(d);
        return (
          <span className="inline-flex items-center gap-1.5">
            <span className={`inline-block h-2 w-2 rounded-full shrink-0 ${dotColor}`} />
            {formatCalendarDate(d, locale)}
          </span>
        );
      },
    },
    { key: 'businessPartner', column: 'C_BPartner_ID', type: 'selector' },
    { key: 'documentStatus', column: 'DocStatus', type: 'status' },
    { key: 'grandTotalAmount', column: 'GrandTotal', type: 'amount' },
    { key: 'outstandingAmount', column: 'OutstandingAmt', type: 'amount' },
  ], [gl, dueDates, locale]);

  return <DataTable columns={columns} filters={filters} {...props} />;
}

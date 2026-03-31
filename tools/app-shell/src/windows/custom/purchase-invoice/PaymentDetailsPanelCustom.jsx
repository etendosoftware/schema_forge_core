import { useState, useEffect } from 'react';
import { formatAmount } from '@/lib/formatAmount.js';

/**
 * PaymentDetailsPanelCustom — two-step fetch for payment details in the classic view.
 *
 * FIN_Payment_ScheduleDetail records are children of FIN_Payment_Schedule (paymentPlan),
 * not direct children of the invoice. The standard secondary-tab hook sends
 * paymentDetails?parentId={invoiceId} which returns nothing.
 *
 * This panel replicates the preview modal logic:
 *   1. Fetch paymentPlan schedules for the invoice.
 *   2. Fetch paymentDetails for each schedule in parallel.
 *   3. Flatten and render.
 */
export default function PaymentDetailsPanelCustom({ parentId, token, apiBaseUrl }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!parentId || !token) return;
    setLoading(true);

    const headers = { Authorization: `Bearer ${token}` };

    fetch(`${apiBaseUrl}/paymentPlan?parentId=${parentId}`, { headers })
      .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
      .then((data) => {
        const schedules = data?.response?.data ?? data?.data ?? [];
        if (schedules.length === 0) return [];
        return Promise.all(
          schedules.map((s) =>
            fetch(`${apiBaseUrl}/paymentDetails?parentId=${s.id}`, { headers })
              .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
              .then((d) => d?.response?.data ?? d?.data ?? [])
              .catch(() => [])
          )
        ).then((results) => results.flat());
      })
      .then((details) => setRows(details))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [parentId, apiBaseUrl, token]);

  if (loading) {
    return <p className="text-sm text-muted-foreground py-4 text-center">Loading...</p>;
  }

  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground py-4 text-center">No payment details found</p>;
  }

  return (
    <table className="w-full text-sm border-collapse">
      <thead>
        <tr className="border-b border-border text-left text-muted-foreground text-xs">
          <th className="py-2 px-3 font-medium">Reference</th>
          <th className="py-2 px-3 font-medium">Date</th>
          <th className="py-2 px-3 font-medium text-right">Amount</th>
          <th className="py-2 px-3 font-medium text-right">Outstanding</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => {
          const parts = (row._identifier ?? '').split(' - ');
          const ref = parts[0] || '—';
          const date = parts[1] || '—';
          return (
            <tr key={row.id ?? i} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
              <td className="py-2 px-3 text-foreground">{ref}</td>
              <td className="py-2 px-3 text-muted-foreground">{date}</td>
              <td className="py-2 px-3 text-right tabular-nums">{formatAmount(row.amount)}</td>
              <td className="py-2 px-3 text-right tabular-nums">{formatAmount(row.outstandingAmt ?? row.outstandingAmount)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

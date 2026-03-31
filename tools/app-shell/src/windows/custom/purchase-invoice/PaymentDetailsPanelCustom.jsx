import { useState, useEffect } from 'react';
import { formatAmount } from '@/lib/formatAmount.js';
import { Check } from 'lucide-react';

const PAYMENT_STATUS = {
  E:      'Executed',
  P:      'Pending',
  PE:     'Partially Executed',
  PPM:    'Payment Made',
  PWNC:   'Withdrawn not Cleared',
  RDNC:   'Deposited not Cleared',
  RPAE:   'Awaiting Execution',
  RPAP:   'Awaiting Payment',
  RPPC:   'Payment Cleared',
  RPR:    'Payment Received',
  RPVOID: 'Void',
};

/**
 * PaymentDetailsPanelCustom — two-step fetch for payment details.
 *
 * The default secondary-tab hook queries paymentDetails?parentId={invoiceId},
 * which returns nothing because FIN_Payment_ScheduleDetail's parent FK is
 * FIN_Payment_Schedule, not C_Invoice.
 *
 * Step 1: fetch paymentPlan schedules for the invoice.
 * Step 2: fetch paymentDetails for each schedule.
 *
 * The backend PaymentDetailsHandler enriches each row with FIN_Payment fields
 * (documentNo, paymentDate, paymentMethod, account, status) via OBDal traversal.
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
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-border text-left text-muted-foreground text-xs">
            <th className="py-2 px-3 font-medium">Document No.</th>
            <th className="py-2 px-3 font-medium">Payment Date</th>
            <th className="py-2 px-3 font-medium">Payment Method</th>
            <th className="py-2 px-3 font-medium">Financial Account</th>
            <th className="py-2 px-3 font-medium text-right">Received Amount</th>
            <th className="py-2 px-3 font-medium">Status</th>
            <th className="py-2 px-3 font-medium">Payment</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.id ?? i} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
              <td className="py-2 px-3 font-medium text-foreground">{row.documentNo || '—'}</td>
              <td className="py-2 px-3 text-muted-foreground">{row.paymentDate || '—'}</td>
              <td className="py-2 px-3 text-muted-foreground">{row['paymentMethod$_identifier'] || '—'}</td>
              <td className="py-2 px-3 text-muted-foreground">{row['account$_identifier'] || '—'}</td>
              <td className="py-2 px-3 text-right tabular-nums">{formatAmount(row.amount)}</td>
              <td className="py-2 px-3 text-muted-foreground">
                {PAYMENT_STATUS[row.status] ?? row.status ?? '—'}
              </td>
              <td className="py-2 px-3 text-muted-foreground">{row['finPaymentID$_identifier'] || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

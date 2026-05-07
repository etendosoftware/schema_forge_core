import { useMemo } from 'react';
import { DataTable } from '@/components/contract-ui';
import { useLocale, useLocaleSwitch } from '@/i18n';
import { formatCalendarDate } from '@/lib/dateOnly';
import {
  getDueDateState,
  getDueDateDotStyle,
  getDueDateTextStyle,
} from '@/lib/invoiceDueDate';

/* eslint-disable react/prop-types */

const filters = ['documentNo', 'invoiceDate', 'businessPartner', 'orderReference', 'documentStatus'];

export default function PurchaseInvoiceHeaderTable(props) {
  const dictionary = useLocale();
  const { locale } = useLocaleSwitch();
  const gl = dictionary?.genericLabels || {};
  const t = (key) => gl[key] || key;

  const columns = useMemo(() => [
    { key: 'invoiceDate', column: 'DateInvoiced', type: 'date', dot: false },
    { key: 'orderReference', column: 'POReference', type: 'string' },
    {
      key: 'eTGODueDate', column: 'EM_Etgo_Due_Date', type: 'custom', label: t('dueDate'),
      render: (row) => {
        const d = row.eTGODueDate;
        if (!d) return <span className="text-muted-foreground">—</span>;
        const state = getDueDateState(d, row.outstandingAmount);
        return (
          <span className="inline-flex items-center gap-1.5" style={getDueDateTextStyle(state)}>
            <span className="inline-block h-2 w-2 rounded-full shrink-0" style={getDueDateDotStyle(state)} />
            {formatCalendarDate(d, locale)}
          </span>
        );
      },
    },
    { key: 'businessPartner', column: 'C_BPartner_ID', type: 'selector' },
    { key: 'documentStatus', column: 'DocStatus', type: 'status' },
    { key: 'grandTotalAmount', column: 'GrandTotal', type: 'amount' },
    { key: 'outstandingAmount', column: 'OutstandingAmt', type: 'amount' },
  ], [gl, locale]);

  return <DataTable columns={columns} filters={filters} {...props} />;
}

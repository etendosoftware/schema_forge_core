import { DataTable } from '@/components/contract-ui';

const columns = [
  { key: 'documentNo', column: 'DocumentNo', type: 'string' },
  { key: 'businessPartner', column: 'C_BPartner_ID', type: 'string' },
  { key: 'paymentDate', column: 'PaymentDate', type: 'date' },
  { key: 'amount', column: 'Amount', type: 'amount' },
  { key: 'currency', column: 'C_Currency_ID', type: 'string' },
  { key: 'status', column: 'Status', type: 'status' },
  { key: 'salesInvoice', column: 'C_Invoice_ID', type: 'string' },
];

const filters = ['documentNo', 'businessPartner', 'paymentDate'];

export default function PaymentInTable(props) {
  return <DataTable columns={columns} filters={filters} {...props} />;
}

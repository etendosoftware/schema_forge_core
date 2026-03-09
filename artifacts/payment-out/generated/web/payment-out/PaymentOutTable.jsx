import { DataTable } from '@/components/contract-ui';

const columns = [
  { key: 'documentNo', label: 'Document No', type: 'string' },
  { key: 'businessPartner', label: 'Business Partner', type: 'string' },
  { key: 'paymentDate', label: 'Payment Date', type: 'date' },
  { key: 'amount', label: 'Amount', type: 'amount' },
  { key: 'currency', label: 'Currency', type: 'string' },
  { key: 'status', label: 'Status', type: 'status' },
  { key: 'purchaseInvoice', label: 'Purchase Invoice', type: 'string' },
];

const filters = ['documentNo', 'businessPartner', 'paymentDate'];

export default function PaymentOutTable(props) {
  return <DataTable columns={columns} filters={filters} {...props} />;
}

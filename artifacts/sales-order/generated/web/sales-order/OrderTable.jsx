import { DataTable } from '@/components/contract-ui';

const columns = [
  { key: 'documentNo', label: 'Document No', type: 'string' },
  { key: 'businessPartner', label: 'Business Partner', type: 'string' },
  { key: 'orderDate', label: 'Order Date', type: 'date' },
  { key: 'currency', label: 'Currency', type: 'string' },
  { key: 'totalLines', label: 'Total Lines', type: 'amount' },
  { key: 'grandTotal', label: 'Grand Total', type: 'amount' },
  { key: 'docStatus', label: 'Doc Status', type: 'status' },
];

const filters = ['documentNo', 'businessPartner', 'docStatus'];

export default function OrderTable(props) {
  return <DataTable columns={columns} filters={filters} {...props} />;
}

import { DataTable } from '@/components/contract-ui';

const columns = [
  { key: 'businessPartner', label: 'Business Partner', type: 'string' },
  { key: 'orderDate', label: 'Order Date', type: 'date' },
  { key: 'validUntil', label: 'Valid Until', type: 'date' },
  { key: 'documentNo', label: 'Document No', type: 'string' },
  { key: 'docStatus', label: 'Doc Status', type: 'status' },
  { key: 'grandTotal', label: 'Grand Total', type: 'amount' },
  { key: 'totalLines', label: 'Total Lines', type: 'amount' },
  { key: 'currency', label: 'Currency', type: 'string' },
];

const filters = ['businessPartner', 'orderDate', 'validUntil', 'documentNo', 'docStatus'];

export default function QuotationTable(props) {
  return <DataTable columns={columns} filters={filters} {...props} />;
}

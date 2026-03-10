import { DataTable } from '@/components/contract-ui';

const columns = [
  { key: 'businessPartner', column: 'C_BPartner_ID', type: 'string' },
  { key: 'orderDate', column: 'DateOrdered', type: 'date' },
  { key: 'documentNo', column: 'DocumentNo', type: 'string' },
  { key: 'docStatus', column: 'DocStatus', type: 'status' },
  { key: 'grandTotal', column: 'GrandTotal', type: 'amount' },
  { key: 'totalLines', column: 'TotalLines', type: 'amount' },
  { key: 'currency', column: 'C_Currency_ID', type: 'string' },
];

const filters = ['businessPartner', 'orderDate', 'documentNo', 'docStatus'];

export default function OrderTable(props) {
  return <DataTable columns={columns} filters={filters} {...props} />;
}

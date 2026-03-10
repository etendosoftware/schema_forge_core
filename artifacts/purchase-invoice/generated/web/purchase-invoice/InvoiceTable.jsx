import { DataTable } from '@/components/contract-ui';

const columns = [
  { key: 'businessPartner', column: 'C_BPartner_ID', type: 'string' },
  { key: 'dateInvoiced', column: 'DateInvoiced', type: 'date' },
  { key: 'currency', column: 'C_Currency_ID', type: 'string' },
  { key: 'poReference', column: 'POReference', type: 'string' },
  { key: 'documentNo', column: 'DocumentNo', type: 'string' },
  { key: 'docStatus', column: 'DocStatus', type: 'status' },
  { key: 'grandTotal', column: 'GrandTotal', type: 'amount' },
  { key: 'totalLines', column: 'TotalLines', type: 'amount' },
  { key: 'isPaid', column: 'IsPaid', type: 'boolean' },
];

const filters = ['businessPartner', 'dateInvoiced', 'poReference', 'documentNo', 'docStatus'];

export default function InvoiceTable(props) {
  return <DataTable columns={columns} filters={filters} {...props} />;
}

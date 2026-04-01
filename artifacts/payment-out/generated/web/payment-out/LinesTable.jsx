import { DataTable } from '@/components/contract-ui';

// @sf-generated-start columns:lines
const columns = [
  { key: 'dueDate', column: 'DueDate', type: 'date' },
  { key: 'expected', column: 'ExpectedAmount', type: 'amount' },
  { key: 'amount', column: 'Amount', type: 'amount' },
  { key: 'orderNo', column: 'DocumentNo', type: 'string' },
  { key: 'invoiceNo', column: 'DocumentNo', type: 'string' },
  { key: 'businessPartner', column: 'C_Bpartner_ID', type: 'string' },
];
// @sf-generated-end columns:lines

const filters = [];

// @sf-generated-start component:LinesTable
export default function LinesTable(props) {
  // @sf-custom-slot hooks:LinesTable
  return <DataTable columns={columns} filters={filters} {...props} />;
}
// @sf-generated-end component:LinesTable

// @sf-custom-slot section:LinesTable-custom

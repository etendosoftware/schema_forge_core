import { DataTable } from '@/components/contract-ui';

// @sf-generated-start columns:lines
const columns = [
  { key: 'lineGrossAmount', column: 'Line_Gross_Amount', type: 'amount', label: 'Line Gross Amount' },
];
// @sf-generated-end columns:lines

const filters = [];

// @sf-generated-start component:LinesTable
export default function LinesTable(props) {
  return <DataTable columns={columns} filters={filters} {...props} />;
}
// @sf-generated-end component:LinesTable

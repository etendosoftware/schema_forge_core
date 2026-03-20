import { DataTable } from '@/components/contract-ui';

// @sf-generated-start columns:lines
const columns = [
  { key: 'lineNo', column: 'Line', type: 'number' },
  { key: 'product', column: 'M_Product_ID', type: 'string' },
  { key: 'invoicedQuantity', column: 'QtyInvoiced', type: 'string' },
  { key: 'unitPrice', column: 'PriceActual', type: 'string' },
  { key: 'lineNetAmount', column: 'LineNetAmt', type: 'amount' },
  { key: 'tax', column: 'C_Tax_ID', type: 'string' },
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

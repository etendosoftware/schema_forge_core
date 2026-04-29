import { DataTable } from '@/components/contract-ui';

// @sf-generated-start columns:lines
const columns = [
  { key: 'product', column: 'M_Product_ID', type: 'selector', label: 'Product' },
  { key: 'description', column: 'Description', type: 'string', label: 'Description' },
  { key: 'invoicedQuantity', column: 'QtyInvoiced', type: 'number', label: 'Invoiced Quantity' },
  { key: 'unitPrice', column: 'PriceActual', type: 'amount', label: 'Net Unit Price' },
  { key: 'tax', column: 'C_Tax_ID', type: 'selector', label: 'Tax' },
  { key: 'grossAmount', column: 'Line_Gross_Amount', type: 'amount', label: 'Line Gross Amount' },
];
// @sf-generated-end columns:lines

const filters = ['product'];

// @sf-generated-start component:LinesTable
export default function LinesTable(props) {
  return <DataTable columns={columns} filters={filters} {...props} />;
}
// @sf-generated-end component:LinesTable

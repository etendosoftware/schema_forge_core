import { DataTable } from '@/components/contract-ui';

// @sf-generated-start columns:quotationLine
const columns = [
  { key: 'product', column: 'M_Product_ID', type: 'selector', label: 'Product' },
  { key: 'description', column: 'Description', type: 'string', label: 'Description' },
  { key: 'orderedQuantity', column: 'QtyOrdered', type: 'number', label: 'Ordered Quantity' },
  { key: 'listPrice', column: 'PriceList', type: 'amount', label: 'Net List Price' },
  { key: 'discount', column: 'Discount', type: 'number', label: 'Discount' },
  { key: 'tax', column: 'C_Tax_ID', type: 'selector', label: 'Tax' },
  { key: 'lineGrossAmount', column: 'Line_Gross_Amount', type: 'amount', label: 'Line Gross Amount' },
];
// @sf-generated-end columns:quotationLine

const filters = ['product'];

// @sf-generated-start component:QuotationLineTable
export default function QuotationLineTable(props) {
  return <DataTable columns={columns} filters={filters} {...props} />;
}
// @sf-generated-end component:QuotationLineTable

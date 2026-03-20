import { DataTable } from '@/components/contract-ui';

// @sf-generated-start columns:quotationLine
const columns = [
  { key: 'lineNo', column: 'Line', type: 'number' },
  { key: 'product', column: 'M_Product_ID', type: 'string' },
  { key: 'orderedQuantity', column: 'QtyOrdered', type: 'string' },
  { key: 'uOM', column: 'C_UOM_ID', type: 'string' },
  { key: 'unitPrice', column: 'PriceActual', type: 'string' },
  { key: 'lineNetAmount', column: 'LineNetAmt', type: 'amount' },
  { key: 'tax', column: 'C_Tax_ID', type: 'string' },
  { key: 'discount', column: 'Discount', type: 'string' },
];
// @sf-generated-end columns:quotationLine

const filters = ['product'];

// @sf-generated-start component:QuotationLineTable
export default function QuotationLineTable(props) {
  // @sf-custom-slot hooks:QuotationLineTable
  return <DataTable columns={columns} filters={filters} {...props} />;
}
// @sf-generated-end component:QuotationLineTable

// @sf-custom-slot section:QuotationLineTable-custom

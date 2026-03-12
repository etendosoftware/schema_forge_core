import { DataTable } from '@/components/contract-ui';

// @sf-generated-start columns:orderLine
const columns = [
  { key: 'product', column: 'M_Product_ID', type: 'string' },
  { key: 'orderedQuantity', column: 'QtyOrdered', type: 'number' },
  { key: 'unitPrice', column: 'PriceActual', type: 'amount' },
  { key: 'tax', column: 'C_Tax_ID', type: 'string' },
  { key: 'discount', column: 'Discount', type: 'number' },
  { key: 'lineNo', column: 'Line', type: 'number' },
  { key: 'lineNetAmount', column: 'LineNetAmt', type: 'amount' },
  { key: 'deliveredQuantity', column: 'QtyDelivered', type: 'number' },
  { key: 'uOM', column: 'C_UOM_ID', type: 'string' },
];
// @sf-generated-end columns:orderLine

const filters = ['product'];

// @sf-generated-start component:OrderLineTable
export default function OrderLineTable(props) {
  // @sf-custom-slot hooks:OrderLineTable
  return <DataTable columns={columns} filters={filters} {...props} />;
}
// @sf-generated-end component:OrderLineTable

// @sf-custom-slot section:OrderLineTable-custom

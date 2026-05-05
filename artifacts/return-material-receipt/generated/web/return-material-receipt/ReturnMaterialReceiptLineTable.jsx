import { DataTable } from '@/components/contract-ui';

// @sf-generated-start columns:returnMaterialReceiptLine
const columns = [
  { key: 'lineNo', column: 'Line', type: 'number', label: 'Line No.' },
  { key: 'product', column: 'M_Product_ID', type: 'selector', label: 'Product' },
  { key: 'movementQuantity', column: 'MovementQty', type: 'number', label: 'Movement Quantity' },
  { key: 'uOM', column: 'C_UOM_ID', type: 'selector', label: 'UOM' },
  { key: 'orderQuantity', column: 'QuantityOrder', type: 'number', label: 'Order Quantity' },
];
// @sf-generated-end columns:returnMaterialReceiptLine

const filters = ['product'];

// @sf-generated-start component:ReturnMaterialReceiptLineTable
export default function ReturnMaterialReceiptLineTable(props) {
  return <DataTable columns={columns} filters={filters} {...props} />;
}
// @sf-generated-end component:ReturnMaterialReceiptLineTable

import { DataTable } from '@/components/contract-ui';

// @sf-generated-start columns:goodsReceiptLine
const columns = [
  { key: 'product', column: 'M_Product_ID', type: 'string' },
  { key: 'movementQty', column: 'MovementQty', type: 'number' },
];
// @sf-generated-end columns:goodsReceiptLine

const filters = ['product'];

// @sf-generated-start component:GoodsReceiptLineTable
export default function GoodsReceiptLineTable(props) {
  // @sf-custom-slot hooks:GoodsReceiptLineTable
  return <DataTable columns={columns} filters={filters} {...props} />;
}
// @sf-generated-end component:GoodsReceiptLineTable

// @sf-custom-slot section:GoodsReceiptLineTable-custom

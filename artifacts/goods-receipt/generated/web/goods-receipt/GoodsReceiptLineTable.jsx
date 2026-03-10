import { DataTable } from '@/components/contract-ui';

const columns = [
  { key: 'product', column: 'M_Product_ID', type: 'string' },
  { key: 'movementQty', column: 'MovementQty', type: 'number' },
  { key: 'locator', column: 'M_Locator_ID', type: 'string' },
  { key: 'lineNo', column: 'Line', type: 'number' },
  { key: 'uom', column: 'C_UOM_ID', type: 'string' },
];

const filters = ['product'];

export default function GoodsReceiptLineTable(props) {
  return <DataTable columns={columns} filters={filters} {...props} />;
}

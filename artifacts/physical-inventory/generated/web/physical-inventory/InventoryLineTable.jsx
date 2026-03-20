import { DataTable } from '@/components/contract-ui';

const columns = [
  { key: 'lineNo', column: 'Line', type: 'number' },
  { key: 'product', column: 'M_Product_ID', type: 'string' },
  { key: 'locator', column: 'M_Locator_ID', type: 'string' },
  { key: 'bookQuantity', column: 'QtyBook', type: 'number' },
  { key: 'countQuantity', column: 'QtyCount', type: 'number' },
  { key: 'adjustmentQuantity', column: 'QtyAdjust', type: 'number' },
  { key: 'uom', column: 'C_UOM_ID', type: 'string' },
];

const filters = ['product'];

export default function InventoryLineTable(props) {
  return <DataTable columns={columns} filters={filters} {...props} />;
}

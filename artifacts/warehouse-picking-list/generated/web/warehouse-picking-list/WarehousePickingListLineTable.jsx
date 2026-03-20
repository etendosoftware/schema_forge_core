import { DataTable } from '@/components/contract-ui';

const columns = [
  { key: 'lineNo', column: 'Line', type: 'number' },
  { key: 'product', column: 'M_Product_ID', type: 'string' },
  { key: 'locator', column: 'M_Locator_ID', type: 'string' },
  { key: 'quantityRequired', column: 'QtyRequired', type: 'number' },
  { key: 'quantityPicked', column: 'QtyPicked', type: 'number' },
  { key: 'salesOrder', column: 'C_Order_ID', type: 'string' },
  { key: 'uom', column: 'C_UOM_ID', type: 'string' },
];

const filters = ['product', 'salesOrder'];

export default function WarehousePickingListLineTable(props) {
  return <DataTable columns={columns} filters={filters} {...props} />;
}

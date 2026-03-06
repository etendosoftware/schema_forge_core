import { DataTable } from '@/components/contract-ui';

const columns = [
  { key: 'lineNo', label: 'Line No', type: 'number' },
  { key: 'product', label: 'Product', type: 'string' },
  { key: 'locator', label: 'Locator', type: 'string' },
  { key: 'quantityRequired', label: 'Quantity Required', type: 'number' },
  { key: 'quantityPicked', label: 'Quantity Picked', type: 'number' },
  { key: 'salesOrder', label: 'Sales Order', type: 'string' },
  { key: 'uom', label: 'Uom', type: 'string' },
];

const filters = ['product', 'salesOrder'];

export default function WarehousePickingListLineTable(props) {
  return <DataTable columns={columns} filters={filters} {...props} />;
}

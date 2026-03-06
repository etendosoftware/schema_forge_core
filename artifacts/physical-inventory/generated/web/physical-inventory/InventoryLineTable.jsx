import { DataTable } from '@/components/contract-ui';

const columns = [
  { key: 'lineNo', label: 'Line No', type: 'number' },
  { key: 'product', label: 'Product', type: 'string' },
  { key: 'locator', label: 'Locator', type: 'string' },
  { key: 'bookQuantity', label: 'Book Quantity', type: 'number' },
  { key: 'countQuantity', label: 'Count Quantity', type: 'number' },
  { key: 'adjustmentQuantity', label: 'Adjustment Quantity', type: 'number' },
  { key: 'uom', label: 'Uom', type: 'string' },
];

const filters = ['product'];

export default function InventoryLineTable(props) {
  return <DataTable columns={columns} filters={filters} {...props} />;
}

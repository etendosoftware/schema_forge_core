import { DataTable } from '@/components/contract-ui';

const columns = [
  { key: 'lineNo', label: 'Line No', type: 'number' },
  { key: 'product', label: 'Product', type: 'string' },
  { key: 'locator', label: 'Locator', type: 'string' },
  { key: 'movementQuantity', label: 'Movement Quantity', type: 'number' },
  { key: 'uom', label: 'Uom', type: 'string' },
  { key: 'isEndProduct', label: 'Is End Product', type: 'boolean' },
];

const filters = ['product'];

export default function ProductionLineTable(props) {
  return <DataTable columns={columns} filters={filters} {...props} />;
}

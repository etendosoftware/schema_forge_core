import { DataTable } from '@/components/contract-ui';

const columns = [
  { key: 'lineNo', label: 'Line No', type: 'number' },
  { key: 'product', label: 'Product', type: 'string' },
  { key: 'quantity', label: 'Quantity', type: 'number' },
  { key: 'weight', label: 'Weight', type: 'number' },
  { key: 'packageNo', label: 'Package No', type: 'string' },
  { key: 'uom', label: 'Uom', type: 'string' },
];

const filters = ['product', 'packageNo'];

export default function PackingLineTable(props) {
  return <DataTable columns={columns} filters={filters} {...props} />;
}

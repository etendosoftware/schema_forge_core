import { DataTable } from '@/components/contract-ui';

const columns = [
  { key: 'lineNo', column: 'Line', type: 'number' },
  { key: 'product', column: 'M_Product_ID', type: 'string' },
  { key: 'quantity', column: 'Qty', type: 'number' },
  { key: 'weight', column: 'Weight', type: 'number' },
  { key: 'packageNo', column: 'PackageNo', type: 'string' },
  { key: 'uom', column: 'C_UOM_ID', type: 'string' },
];

const filters = ['product', 'packageNo'];

export default function PackingLineTable(props) {
  return <DataTable columns={columns} filters={filters} {...props} />;
}

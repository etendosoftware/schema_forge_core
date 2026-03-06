import { DataTable } from '@/components/contract-ui';

const columns = [
  { key: 'name', label: 'Name', type: 'string' },
  { key: 'searchKey', label: 'Search Key', type: 'string' },
  { key: 'uom', label: 'Uom', type: 'string' },
  { key: 'productCategory', label: 'Product Category', type: 'string' },
  { key: 'listPrice', label: 'List Price', type: 'amount' },
  { key: 'isActive', label: 'Is Active', type: 'string' },
];

const filters = ['name', 'searchKey'];

export default function ProductTable(props) {
  return <DataTable columns={columns} filters={filters} {...props} />;
}

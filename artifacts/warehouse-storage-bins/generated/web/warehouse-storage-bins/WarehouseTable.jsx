import { DataTable } from '@/components/contract-ui';

const columns = [
  { key: 'searchKey', label: 'Search Key', type: 'string' },
  { key: 'name', label: 'Name', type: 'string' },
  { key: 'city', label: 'City', type: 'string' },
  { key: 'country', label: 'Country', type: 'string' },
  { key: 'isActive', label: 'Is Active', type: 'boolean' },
];

const filters = ['searchKey', 'name', 'city'];

export default function WarehouseTable(props) {
  return <DataTable columns={columns} filters={filters} {...props} />;
}

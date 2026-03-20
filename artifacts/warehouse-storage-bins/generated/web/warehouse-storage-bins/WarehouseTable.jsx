import { DataTable } from '@/components/contract-ui';

const columns = [
  { key: 'searchKey', column: 'Value', type: 'string' },
  { key: 'name', column: 'Name', type: 'string' },
  { key: 'city', column: 'City', type: 'string' },
  { key: 'country', column: 'C_Country_ID', type: 'string' },
  { key: 'isActive', column: 'IsActive', type: 'boolean' },
];

const filters = ['searchKey', 'name', 'city'];

export default function WarehouseTable(props) {
  return <DataTable columns={columns} filters={filters} {...props} />;
}

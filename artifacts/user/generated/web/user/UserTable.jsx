import { DataTable } from '@/components/contract-ui';

const columns = [
  { key: 'name', column: 'Name', type: 'string' },
  { key: 'email', column: 'EMail', type: 'string' },
  { key: 'isActive', column: 'IsActive', type: 'boolean' },
];

const filters = ['name', 'email'];

export default function UserTable(props) {
  return <DataTable columns={columns} filters={filters} {...props} />;
}

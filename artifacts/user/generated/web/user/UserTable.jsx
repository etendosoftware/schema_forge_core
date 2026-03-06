import { DataTable } from '@/components/contract-ui';

const columns = [
  { key: 'name', label: 'Name', type: 'string' },
  { key: 'email', label: 'Email', type: 'string' },
  { key: 'isActive', label: 'Is Active', type: 'string' },
];

const filters = ['name', 'email'];

export default function UserTable(props) {
  return <DataTable columns={columns} filters={filters} {...props} />;
}

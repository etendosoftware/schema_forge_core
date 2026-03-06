import { DataTable } from '@/components/contract-ui';

const columns = [
  { key: 'searchKey', label: 'Search Key', type: 'string' },
  { key: 'x', label: 'X', type: 'string' },
  { key: 'y', label: 'Y', type: 'string' },
  { key: 'z', label: 'Z', type: 'string' },
  { key: 'priorityNo', label: 'Priority No', type: 'number' },
  { key: 'isDefault', label: 'Is Default', type: 'boolean' },
  { key: 'isActive', label: 'Is Active', type: 'boolean' },
];

const filters = ['searchKey'];

export default function LocatorTable(props) {
  return <DataTable columns={columns} filters={filters} {...props} />;
}

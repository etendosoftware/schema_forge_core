import { DataTable } from '@/components/contract-ui';

const columns = [
  { key: 'searchKey', column: 'Value', type: 'string' },
  { key: 'x', column: 'X', type: 'string' },
  { key: 'y', column: 'Y', type: 'string' },
  { key: 'z', column: 'Z', type: 'string' },
  { key: 'priorityNo', column: 'PriorityNo', type: 'number' },
  { key: 'isDefault', column: 'IsDefault', type: 'boolean' },
  { key: 'isActive', column: 'IsActive', type: 'boolean' },
];

const filters = ['searchKey'];

export default function LocatorTable(props) {
  return <DataTable columns={columns} filters={filters} {...props} />;
}

import { DataTable } from '@/components/contract-ui';

const columns = [
  { key: 'documentNo', label: 'Document No', type: 'string' },
  { key: 'pickDate', label: 'Pick Date', type: 'date' },
  { key: 'warehouse', label: 'Warehouse', type: 'string' },
  { key: 'status', label: 'Status', type: 'status' },
  { key: 'assignedTo', label: 'Assigned To', type: 'string' },
  { key: 'priority', label: 'Priority', type: 'string' },
];

const filters = ['documentNo', 'pickDate', 'warehouse', 'status', 'assignedTo', 'priority'];

export default function WarehousePickingListTable(props) {
  return <DataTable columns={columns} filters={filters} {...props} />;
}

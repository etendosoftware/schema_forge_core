import { DataTable } from '@/components/contract-ui';

const columns = [
  { key: 'documentNo', column: 'DocumentNo', type: 'string' },
  { key: 'pickDate', column: 'PickDate', type: 'date' },
  { key: 'warehouse', column: 'M_Warehouse_ID', type: 'string' },
  { key: 'status', column: 'Status', type: 'status' },
  { key: 'assignedTo', column: 'AssignedTo_ID', type: 'string' },
  { key: 'priority', column: 'Priority', type: 'string' },
];

const filters = ['documentNo', 'pickDate', 'warehouse', 'status', 'assignedTo', 'priority'];

export default function WarehousePickingListTable(props) {
  return <DataTable columns={columns} filters={filters} {...props} />;
}

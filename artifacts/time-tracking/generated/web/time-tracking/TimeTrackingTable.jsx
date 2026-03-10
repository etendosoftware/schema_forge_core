import { DataTable } from '@/components/contract-ui';

const columns = [
  { key: 'employee', column: 'Employee_ID', type: 'string' },
  { key: 'project', column: 'Project_ID', type: 'string' },
  { key: 'date', column: 'WorkDate', type: 'date' },
  { key: 'hours', column: 'Hours', type: 'number' },
  { key: 'description', column: 'Description', type: 'string' },
  { key: 'category', column: 'Category', type: 'string' },
  { key: 'billable', column: 'Billable', type: 'string' },
  { key: 'status', column: 'Status', type: 'status' },
];

const filters = ['employee', 'project', 'status'];

export default function TimeTrackingTable(props) {
  return <DataTable columns={columns} filters={filters} {...props} />;
}

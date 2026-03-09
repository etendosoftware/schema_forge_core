import { DataTable } from '@/components/contract-ui';

const columns = [
  { key: 'employee', label: 'Employee', type: 'string' },
  { key: 'project', label: 'Project', type: 'string' },
  { key: 'date', label: 'Date', type: 'date' },
  { key: 'hours', label: 'Hours', type: 'number' },
  { key: 'description', label: 'Description', type: 'string' },
  { key: 'category', label: 'Category', type: 'string' },
  { key: 'billable', label: 'Billable', type: 'string' },
  { key: 'status', label: 'Status', type: 'status' },
];

const filters = ['employee', 'project', 'status'];

export default function TimeTrackingTable(props) {
  return <DataTable columns={columns} filters={filters} {...props} />;
}

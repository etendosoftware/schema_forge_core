import { DataTable } from '@/components/contract-ui';

const columns = [
  { key: 'employee', label: 'Employee', type: 'string' },
  { key: 'type', label: 'Type', type: 'string' },
  { key: 'startDate', label: 'Start Date', type: 'date' },
  { key: 'endDate', label: 'End Date', type: 'date' },
  { key: 'days', label: 'Days', type: 'number' },
  { key: 'status', label: 'Status', type: 'status' },
  { key: 'approvedBy', label: 'Approved By', type: 'string' },
];

const filters = ['employee', 'type', 'status'];

export default function AbsenceTable(props) {
  return <DataTable columns={columns} filters={filters} {...props} />;
}

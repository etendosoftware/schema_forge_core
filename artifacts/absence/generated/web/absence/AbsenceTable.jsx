import { DataTable } from '@/components/contract-ui';

const columns = [
  { key: 'employee', column: 'Employee_ID', type: 'string' },
  { key: 'type', column: 'AbsenceType', type: 'string' },
  { key: 'startDate', column: 'StartDate', type: 'date' },
  { key: 'endDate', column: 'EndDate', type: 'date' },
  { key: 'days', column: 'Days', type: 'number' },
  { key: 'status', column: 'Status', type: 'status' },
  { key: 'approvedBy', column: 'ApprovedBy_ID', type: 'string' },
];

const filters = ['employee', 'type', 'status'];

export default function AbsenceTable(props) {
  return <DataTable columns={columns} filters={filters} {...props} />;
}

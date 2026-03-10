import { DataTable } from '@/components/contract-ui';

const columns = [
  { key: 'name', column: 'Name', type: 'string' },
  { key: 'employeeId', column: 'EmployeeId', type: 'string' },
  { key: 'department', column: 'Department', type: 'string' },
  { key: 'position', column: 'Position', type: 'string' },
  { key: 'email', column: 'Email', type: 'string' },
  { key: 'phone', column: 'Phone', type: 'string' },
  { key: 'startDate', column: 'StartDate', type: 'date' },
  { key: 'status', column: 'Status', type: 'status' },
  { key: 'manager', column: 'Manager_ID', type: 'string' },
];

const filters = ['name', 'department', 'status'];

export default function EmployeeTable(props) {
  return <DataTable columns={columns} filters={filters} {...props} />;
}

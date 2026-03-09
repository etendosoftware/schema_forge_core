import { DataTable } from '@/components/contract-ui';

const columns = [
  { key: 'name', label: 'Name', type: 'string' },
  { key: 'employeeId', label: 'Employee Id', type: 'string' },
  { key: 'department', label: 'Department', type: 'string' },
  { key: 'position', label: 'Position', type: 'string' },
  { key: 'email', label: 'Email', type: 'string' },
  { key: 'phone', label: 'Phone', type: 'string' },
  { key: 'startDate', label: 'Start Date', type: 'date' },
  { key: 'status', label: 'Status', type: 'status' },
  { key: 'manager', label: 'Manager', type: 'string' },
];

const filters = ['name', 'department', 'status'];

export default function EmployeeTable(props) {
  return <DataTable columns={columns} filters={filters} {...props} />;
}

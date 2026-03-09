import { EntityForm } from '@/components/contract-ui';

const fields = [
  { key: 'name', label: 'Name', type: 'text', required: true },
  { key: 'employeeId', label: 'Employee Id', type: 'text', required: true, readOnly: true },
  { key: 'department', label: 'Department', type: 'selector', required: true, reference: 'Department', inputMode: 'selector' },
  { key: 'position', label: 'Position', type: 'text', required: true },
  { key: 'email', label: 'Email', type: 'text', required: true },
  { key: 'phone', label: 'Phone', type: 'text' },
  { key: 'startDate', label: 'Start Date', type: 'date', required: true },
  { key: 'status', label: 'Status', type: 'selector', required: true, reference: 'EmployeeStatus', inputMode: 'selector' },
  { key: 'manager', label: 'Manager', type: 'selector', reference: 'User', inputMode: 'selector' },
];

export default function EmployeeForm(props) {
  return <EntityForm fields={fields} {...props} />;
}

import { EntityForm } from '@/components/contract-ui';

const fields = [
  { key: 'name', column: 'Name', type: 'text', required: true },
  { key: 'employeeId', column: 'EmployeeId', type: 'text', required: true, readOnly: true },
  { key: 'department', column: 'Department', type: 'selector', required: true, reference: 'Department', inputMode: 'selector' },
  { key: 'position', column: 'Position', type: 'text', required: true },
  { key: 'email', column: 'Email', type: 'text', required: true },
  { key: 'phone', column: 'Phone', type: 'text' },
  { key: 'startDate', column: 'StartDate', type: 'date', required: true },
  { key: 'status', column: 'Status', type: 'selector', required: true, reference: 'EmployeeStatus', inputMode: 'selector' },
  { key: 'manager', column: 'Manager_ID', type: 'selector', reference: 'User', inputMode: 'selector' },
];

export default function EmployeeForm(props) {
  return <EntityForm fields={fields} {...props} />;
}

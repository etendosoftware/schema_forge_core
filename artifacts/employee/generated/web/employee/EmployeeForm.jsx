import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:employee
const fields = [
  { key: 'name', column: 'Name', type: 'text', required: true, section: 'principal' },
  { key: 'employeeId', column: 'EmployeeId', type: 'text', required: true, readOnly: true, section: 'other' },
  { key: 'department', column: 'Department', type: 'selector', required: true, section: 'principal', reference: 'Department', inputMode: 'selector' },
  { key: 'position', column: 'Position', type: 'text', required: true, section: 'principal' },
  { key: 'email', column: 'Email', type: 'text', required: true, section: 'principal' },
  { key: 'phone', column: 'Phone', type: 'text', section: 'other' },
  { key: 'startDate', column: 'StartDate', type: 'date', required: true, section: 'other' },
  { key: 'status', column: 'Status', type: 'selector', required: true, section: 'other', reference: 'EmployeeStatus', inputMode: 'selector' },
  { key: 'manager', column: 'Manager_ID', type: 'selector', section: 'other', reference: 'User', inputMode: 'selector' },
];
// @sf-generated-end fields:employee

// @sf-generated-start component:EmployeeForm
export default function EmployeeForm(props) {
  // @sf-custom-slot hooks:EmployeeForm
  return <EntityForm fields={fields} {...props} />;
}
// @sf-generated-end component:EmployeeForm

// @sf-custom-slot section:EmployeeForm-custom

import { EntityForm } from '@/components/contract-ui';

const fields = [
  { key: 'employee', column: 'Employee_ID', type: 'selector', required: true, reference: 'User', inputMode: 'selector' },
  { key: 'project', column: 'Project_ID', type: 'selector', required: true, reference: 'Project', inputMode: 'selector' },
  { key: 'date', column: 'WorkDate', type: 'date', required: true },
  { key: 'hours', column: 'Hours', type: 'number', required: true },
  { key: 'description', column: 'Description', type: 'textarea' },
  { key: 'category', column: 'Category', type: 'selector', required: true, reference: 'TimeCategory', inputMode: 'selector' },
  { key: 'billable', column: 'Billable', type: 'selector', required: true, reference: 'YesNo', inputMode: 'selector' },
  { key: 'status', column: 'Status', type: 'selector', required: true, reference: 'TimeStatus', inputMode: 'selector' },
];

export default function TimeTrackingForm(props) {
  return <EntityForm fields={fields} {...props} />;
}

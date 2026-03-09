import { EntityForm } from '@/components/contract-ui';

const fields = [
  { key: 'employee', label: 'Employee', type: 'selector', required: true, reference: 'User', inputMode: 'selector' },
  { key: 'project', label: 'Project', type: 'selector', required: true, reference: 'Project', inputMode: 'selector' },
  { key: 'date', label: 'Date', type: 'date', required: true },
  { key: 'hours', label: 'Hours', type: 'number', required: true },
  { key: 'description', label: 'Description', type: 'textarea' },
  { key: 'category', label: 'Category', type: 'selector', required: true, reference: 'TimeCategory', inputMode: 'selector' },
  { key: 'billable', label: 'Billable', type: 'selector', required: true, reference: 'YesNo', inputMode: 'selector' },
  { key: 'status', label: 'Status', type: 'selector', required: true, reference: 'TimeStatus', inputMode: 'selector' },
];

export default function TimeTrackingForm(props) {
  return <EntityForm fields={fields} {...props} />;
}

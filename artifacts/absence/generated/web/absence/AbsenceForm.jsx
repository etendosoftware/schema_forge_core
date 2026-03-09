import { EntityForm } from '@/components/contract-ui';

const fields = [
  { key: 'employee', label: 'Employee', type: 'selector', required: true, reference: 'User', inputMode: 'selector' },
  { key: 'type', label: 'Type', type: 'selector', required: true, reference: 'AbsenceType', inputMode: 'selector' },
  { key: 'startDate', label: 'Start Date', type: 'date', required: true },
  { key: 'endDate', label: 'End Date', type: 'date', required: true },
  { key: 'status', label: 'Status', type: 'selector', required: true, reference: 'AbsenceStatus', inputMode: 'selector' },
  { key: 'reason', label: 'Reason', type: 'text' },
];

export default function AbsenceForm(props) {
  return <EntityForm fields={fields} {...props} />;
}

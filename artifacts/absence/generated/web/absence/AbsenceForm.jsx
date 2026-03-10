import { EntityForm } from '@/components/contract-ui';

const fields = [
  { key: 'employee', column: 'Employee_ID', type: 'selector', required: true, reference: 'User', inputMode: 'selector' },
  { key: 'type', column: 'AbsenceType', type: 'selector', required: true, reference: 'AbsenceType', inputMode: 'selector' },
  { key: 'startDate', column: 'StartDate', type: 'date', required: true },
  { key: 'endDate', column: 'EndDate', type: 'date', required: true },
  { key: 'days', column: 'Days', type: 'number', required: true, readOnly: true },
  { key: 'status', column: 'Status', type: 'selector', required: true, reference: 'AbsenceStatus', inputMode: 'selector' },
  { key: 'reason', column: 'Reason', type: 'text' },
  { key: 'approvedBy', column: 'ApprovedBy_ID', type: 'selector', readOnly: true, reference: 'User', inputMode: 'selector' },
];

export default function AbsenceForm(props) {
  return <EntityForm fields={fields} {...props} />;
}

import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:absence
const fields = [
  { key: 'employee', column: 'Employee_ID', type: 'selector', required: true, section: 'principal', reference: 'User', inputMode: 'selector' },
  { key: 'type', column: 'AbsenceType', type: 'selector', required: true, section: 'principal', reference: 'AbsenceType', inputMode: 'selector' },
  { key: 'startDate', column: 'StartDate', type: 'date', required: true, section: 'principal' },
  { key: 'endDate', column: 'EndDate', type: 'date', required: true, section: 'principal' },
  { key: 'days', column: 'Days', type: 'number', required: true, readOnly: true, section: 'other' },
  { key: 'status', column: 'Status', type: 'selector', required: true, section: 'other', reference: 'AbsenceStatus', inputMode: 'selector' },
  { key: 'reason', column: 'Reason', type: 'text', section: 'other' },
  { key: 'approvedBy', column: 'ApprovedBy_ID', type: 'selector', readOnly: true, section: 'other', reference: 'User', inputMode: 'selector' },
];
// @sf-generated-end fields:absence

// @sf-generated-start component:AbsenceForm
export default function AbsenceForm(props) {
  // @sf-custom-slot hooks:AbsenceForm
  return <EntityForm fields={fields} {...props} />;
}
// @sf-generated-end component:AbsenceForm

// @sf-custom-slot section:AbsenceForm-custom

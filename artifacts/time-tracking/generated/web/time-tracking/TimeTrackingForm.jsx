import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:timeTracking
const fields = [
  { key: 'employee', column: 'Employee_ID', type: 'selector', required: true, section: 'principal', reference: 'User', inputMode: 'selector' },
  { key: 'project', column: 'Project_ID', type: 'selector', required: true, section: 'principal', reference: 'Project', inputMode: 'selector' },
  { key: 'date', column: 'WorkDate', type: 'date', required: true, section: 'principal' },
  { key: 'hours', column: 'Hours', type: 'number', required: true, section: 'principal' },
  { key: 'description', column: 'Description', type: 'textarea', section: 'other' },
  { key: 'category', column: 'Category', type: 'selector', required: true, section: 'other', reference: 'TimeCategory', inputMode: 'selector' },
  { key: 'billable', column: 'Billable', type: 'selector', required: true, section: 'other', reference: 'YesNo', inputMode: 'selector' },
  { key: 'status', column: 'Status', type: 'selector', required: true, section: 'other', reference: 'TimeStatus', inputMode: 'selector' },
];
// @sf-generated-end fields:timeTracking

// @sf-generated-start component:TimeTrackingForm
export default function TimeTrackingForm(props) {
  // @sf-custom-slot hooks:TimeTrackingForm
  return <EntityForm fields={fields} {...props} />;
}
// @sf-generated-end component:TimeTrackingForm

// @sf-custom-slot section:TimeTrackingForm-custom

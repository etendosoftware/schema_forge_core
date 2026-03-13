import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:activity
const fields = [
  { key: 'type', column: 'Type', type: 'selector', required: true, section: 'principal', reference: 'ActivityType', inputMode: 'selector' },
  { key: 'subject', column: 'Subject', type: 'text', required: true, section: 'principal' },
  { key: 'deal', column: 'CRM_Deal_ID', type: 'search', section: 'principal', reference: 'Deal', inputMode: 'search' },
  { key: 'contact', column: 'C_BPartner_ID', type: 'search', section: 'principal', reference: 'BusinessPartner', inputMode: 'search' },
  { key: 'assignedTo', column: 'AssignedTo_ID', type: 'selector', section: 'other', reference: 'User', inputMode: 'selector' },
  { key: 'dueDate', column: 'DueDate', type: 'date', section: 'other' },
  { key: 'status', column: 'Status', type: 'selector', required: true, section: 'other', reference: 'ActivityStatus', inputMode: 'selector' },
  { key: 'notes', column: 'Notes', type: 'textarea', section: 'other' },
  { key: 'duration', column: 'Duration', type: 'number', section: 'other' },
];
// @sf-generated-end fields:activity

// @sf-generated-start component:ActivityForm
export default function ActivityForm(props) {
  // @sf-custom-slot hooks:ActivityForm
  return <EntityForm fields={fields} {...props} />;
}
// @sf-generated-end component:ActivityForm

// @sf-custom-slot section:ActivityForm-custom

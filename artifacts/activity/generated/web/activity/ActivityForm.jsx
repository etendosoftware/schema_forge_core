import { EntityForm } from '@/components/contract-ui';

const fields = [
  { key: 'type', column: 'Type', type: 'selector', required: true, reference: 'ActivityType', inputMode: 'selector' },
  { key: 'subject', column: 'Subject', type: 'text', required: true },
  { key: 'deal', column: 'CRM_Deal_ID', type: 'search', reference: 'Deal', inputMode: 'search' },
  { key: 'contact', column: 'C_BPartner_ID', type: 'search', reference: 'BusinessPartner', inputMode: 'search' },
  { key: 'assignedTo', column: 'AssignedTo_ID', type: 'selector', reference: 'User', inputMode: 'selector' },
  { key: 'dueDate', column: 'DueDate', type: 'date' },
  { key: 'status', column: 'Status', type: 'selector', required: true, reference: 'ActivityStatus', inputMode: 'selector' },
  { key: 'notes', column: 'Notes', type: 'textarea' },
  { key: 'duration', column: 'Duration', type: 'number' },
];

export default function ActivityForm(props) {
  return <EntityForm fields={fields} {...props} />;
}

import { EntityForm } from '@/components/contract-ui';

const fields = [
  { key: 'type', label: 'Type', type: 'selector', required: true, reference: 'ActivityType', inputMode: 'selector' },
  { key: 'subject', label: 'Subject', type: 'text', required: true },
  { key: 'deal', label: 'Deal', type: 'search', reference: 'Deal', inputMode: 'search' },
  { key: 'contact', label: 'Contact', type: 'search', reference: 'BusinessPartner', inputMode: 'search' },
  { key: 'assignedTo', label: 'Assigned To', type: 'selector', reference: 'User', inputMode: 'selector' },
  { key: 'dueDate', label: 'Due Date', type: 'date' },
  { key: 'status', label: 'Status', type: 'selector', required: true, reference: 'ActivityStatus', inputMode: 'selector' },
  { key: 'notes', label: 'Notes', type: 'textarea' },
  { key: 'duration', label: 'Duration', type: 'number' },
];

export default function ActivityForm(props) {
  return <EntityForm fields={fields} {...props} />;
}

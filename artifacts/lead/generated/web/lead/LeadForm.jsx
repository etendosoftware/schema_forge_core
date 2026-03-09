import { EntityForm } from '@/components/contract-ui';

const fields = [
  { key: 'name', label: 'Name', type: 'text', required: true },
  { key: 'company', label: 'Company', type: 'text' },
  { key: 'email', label: 'Email', type: 'text' },
  { key: 'phone', label: 'Phone', type: 'text' },
  { key: 'source', label: 'Source', type: 'selector', reference: 'LeadSource', inputMode: 'selector' },
  { key: 'status', label: 'Status', type: 'selector', required: true, reference: 'LeadStatus', inputMode: 'selector' },
  { key: 'assignedTo', label: 'Assigned To', type: 'selector', reference: 'User', inputMode: 'selector' },
  { key: 'estimatedValue', label: 'Estimated Value', type: 'number' },
  { key: 'notes', label: 'Notes', type: 'textarea' },
];

export default function LeadForm(props) {
  return <EntityForm fields={fields} {...props} />;
}

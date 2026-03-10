import { EntityForm } from '@/components/contract-ui';

const fields = [
  { key: 'name', column: 'Name', type: 'text', required: true },
  { key: 'company', column: 'Company', type: 'text' },
  { key: 'email', column: 'Email', type: 'text' },
  { key: 'phone', column: 'Phone', type: 'text' },
  { key: 'source', column: 'Source', type: 'selector', reference: 'LeadSource', inputMode: 'selector' },
  { key: 'status', column: 'Status', type: 'selector', required: true, reference: 'LeadStatus', inputMode: 'selector' },
  { key: 'assignedTo', column: 'AssignedTo_ID', type: 'selector', reference: 'User', inputMode: 'selector' },
  { key: 'estimatedValue', column: 'EstimatedValue', type: 'number' },
  { key: 'notes', column: 'Notes', type: 'textarea' },
];

export default function LeadForm(props) {
  return <EntityForm fields={fields} {...props} />;
}

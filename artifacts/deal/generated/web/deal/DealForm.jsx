import { EntityForm } from '@/components/contract-ui';

const fields = [
  { key: 'name', label: 'Name', type: 'text', required: true },
  { key: 'businessPartner', label: 'Business Partner', type: 'search', required: true, reference: 'BusinessPartner', inputMode: 'search' },
  { key: 'stage', label: 'Stage', type: 'selector', required: true, reference: 'DealStage', inputMode: 'selector' },
  { key: 'amount', label: 'Amount', type: 'number', required: true },
  { key: 'currency', label: 'Currency', type: 'selector', required: true, reference: 'Currency', inputMode: 'selector' },
  { key: 'probability', label: 'Probability', type: 'number' },
  { key: 'expectedCloseDate', label: 'Expected Close Date', type: 'date' },
  { key: 'assignedTo', label: 'Assigned To', type: 'selector', reference: 'User', inputMode: 'selector' },
  { key: 'source', label: 'Source', type: 'selector', reference: 'LeadSource', inputMode: 'selector' },
];

export default function DealForm(props) {
  return <EntityForm fields={fields} {...props} />;
}

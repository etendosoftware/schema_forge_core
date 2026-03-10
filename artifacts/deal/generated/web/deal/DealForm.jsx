import { EntityForm } from '@/components/contract-ui';

const fields = [
  { key: 'name', column: 'Name', type: 'text', required: true },
  { key: 'businessPartner', column: 'C_BPartner_ID', type: 'search', required: true, reference: 'BusinessPartner', inputMode: 'search' },
  { key: 'stage', column: 'Stage', type: 'selector', required: true, reference: 'DealStage', inputMode: 'selector' },
  { key: 'amount', column: 'Amount', type: 'number', required: true },
  { key: 'currency', column: 'C_Currency_ID', type: 'selector', required: true, reference: 'Currency', inputMode: 'selector' },
  { key: 'probability', column: 'Probability', type: 'number' },
  { key: 'expectedCloseDate', column: 'ExpectedCloseDate', type: 'date' },
  { key: 'assignedTo', column: 'AssignedTo_ID', type: 'selector', reference: 'User', inputMode: 'selector' },
  { key: 'source', column: 'Source', type: 'selector', reference: 'LeadSource', inputMode: 'selector' },
];

export default function DealForm(props) {
  return <EntityForm fields={fields} {...props} />;
}

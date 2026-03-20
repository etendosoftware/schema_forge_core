import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:deal
const fields = [
  { key: 'name', column: 'Name', type: 'text', required: true, section: 'principal' },
  { key: 'businessPartner', column: 'C_BPartner_ID', type: 'search', required: true, section: 'principal', reference: 'BusinessPartner', inputMode: 'search' },
  { key: 'stage', column: 'Stage', type: 'selector', required: true, section: 'principal', reference: 'DealStage', inputMode: 'selector' },
  { key: 'amount', column: 'Amount', type: 'number', required: true, section: 'principal' },
  { key: 'currency', column: 'C_Currency_ID', type: 'selector', required: true, section: 'other', reference: 'Currency', inputMode: 'selector' },
  { key: 'probability', column: 'Probability', type: 'number', section: 'other' },
  { key: 'expectedCloseDate', column: 'ExpectedCloseDate', type: 'date', section: 'other' },
  { key: 'assignedTo', column: 'AssignedTo_ID', type: 'selector', section: 'other', reference: 'User', inputMode: 'selector' },
  { key: 'source', column: 'Source', type: 'selector', section: 'other', reference: 'LeadSource', inputMode: 'selector' },
];
// @sf-generated-end fields:deal

// @sf-generated-start component:DealForm
export default function DealForm(props) {
  // @sf-custom-slot hooks:DealForm
  return <EntityForm fields={fields} {...props} />;
}
// @sf-generated-end component:DealForm

// @sf-custom-slot section:DealForm-custom

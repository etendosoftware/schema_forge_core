import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:commission
const fields = [
  { key: 'name', column: 'Name', type: 'text', required: true, section: 'principal' },
  { key: 'description', column: 'Description', type: 'textarea', section: 'principal' },
  { key: 'businessPartner', column: 'C_BPartner_ID', type: 'search', required: true, section: 'principal', reference: 'BusinessPartner', inputMode: 'search' },
  { key: 'currency', column: 'C_Currency_ID', type: 'selector', required: true, section: 'principal', reference: 'Currency', inputMode: 'selector' },
  { key: 'frequencyType', column: 'FrequencyType', type: 'text', required: true, section: 'other' },
  { key: 'isActive', column: 'IsActive', type: 'checkbox', required: true, section: 'other' },
  { key: 'dateLastRun', column: 'DateLastRun', type: 'date', readOnly: true, section: 'other' },
];
// @sf-generated-end fields:commission

// @sf-generated-start component:CommissionForm
export default function CommissionForm(props) {
  // @sf-custom-slot hooks:CommissionForm
  return <EntityForm fields={fields} {...props} />;
}
// @sf-generated-end component:CommissionForm

// @sf-custom-slot section:CommissionForm-custom

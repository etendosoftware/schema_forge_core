import { EntityForm } from '@/components/contract-ui';

const fields = [
  { key: 'name', column: 'Name', type: 'text', required: true },
  { key: 'description', column: 'Description', type: 'textarea' },
  { key: 'businessPartner', column: 'C_BPartner_ID', type: 'search', required: true, reference: 'BusinessPartner', inputMode: 'search' },
  { key: 'currency', column: 'C_Currency_ID', type: 'selector', required: true, reference: 'Currency', inputMode: 'selector' },
  { key: 'frequencyType', column: 'FrequencyType', type: 'text', required: true },
  { key: 'isActive', column: 'IsActive', type: 'checkbox', required: true },
  { key: 'dateLastRun', column: 'DateLastRun', type: 'date', readOnly: true },
];

export default function CommissionForm(props) {
  return <EntityForm fields={fields} {...props} />;
}

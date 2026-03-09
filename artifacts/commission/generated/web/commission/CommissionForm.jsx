import { EntityForm } from '@/components/contract-ui';

const fields = [
  { key: 'name', label: 'Name', type: 'text', required: true },
  { key: 'description', label: 'Description', type: 'textarea' },
  { key: 'businessPartner', label: 'Business Partner', type: 'search', required: true, reference: 'BusinessPartner', inputMode: 'search' },
  { key: 'currency', label: 'Currency', type: 'selector', required: true, reference: 'Currency', inputMode: 'selector' },
  { key: 'frequencyType', label: 'Frequency Type', type: 'text', required: true },
  { key: 'isActive', label: 'Is Active', type: 'checkbox', required: true },
  { key: 'dateLastRun', label: 'Date Last Run', type: 'date', readOnly: true },
];

export default function CommissionForm(props) {
  return <EntityForm fields={fields} {...props} />;
}

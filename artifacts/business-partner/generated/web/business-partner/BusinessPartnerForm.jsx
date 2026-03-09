import { EntityForm } from '@/components/contract-ui';

const fields = [
  { key: 'name', label: 'Name', type: 'text', required: true },
  { key: 'searchKey', label: 'Search Key', type: 'text', required: true },
  { key: 'taxId', label: 'Tax Id', type: 'text' },
  { key: 'description', label: 'Description', type: 'textarea' },
  { key: 'creditLimit', label: 'Credit Limit', type: 'number' },
  { key: 'isActive', label: 'Is Active', type: 'checkbox', required: true, readOnly: true },
];

export default function BusinessPartnerForm(props) {
  return <EntityForm fields={fields} {...props} />;
}

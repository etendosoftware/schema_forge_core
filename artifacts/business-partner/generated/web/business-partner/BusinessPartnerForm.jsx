import { EntityForm } from '@/components/contract-ui';

const fields = [
  { key: 'name', column: 'Name', type: 'text', required: true },
  { key: 'searchKey', column: 'Value', type: 'text', required: true },
  { key: 'taxId', column: 'TaxID', type: 'text' },
  { key: 'description', column: 'Description', type: 'textarea' },
  { key: 'creditLimit', column: 'SO_CreditLimit', type: 'number' },
  { key: 'isActive', column: 'IsActive', type: 'checkbox', required: true, readOnly: true },
];

export default function BusinessPartnerForm(props) {
  return <EntityForm fields={fields} {...props} />;
}

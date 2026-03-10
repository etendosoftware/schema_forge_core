import { EntityForm } from '@/components/contract-ui';

const fields = [
  { key: 'name', column: 'Name', type: 'text', required: true },
  { key: 'description', column: 'Description', type: 'textarea' },
  { key: 'isActive', column: 'IsActive', type: 'checkbox', required: true, readOnly: true },
];

export default function PaymentMethodForm(props) {
  return <EntityForm fields={fields} {...props} />;
}

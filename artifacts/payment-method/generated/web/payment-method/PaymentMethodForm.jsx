import { EntityForm } from '@/components/contract-ui';

const fields = [
  { key: 'name', label: 'Name', type: 'text', required: true },
  { key: 'description', label: 'Description', type: 'text' },
];

export default function PaymentMethodForm(props) {
  return <EntityForm fields={fields} {...props} />;
}

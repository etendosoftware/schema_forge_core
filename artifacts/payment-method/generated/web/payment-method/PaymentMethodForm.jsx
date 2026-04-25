import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:paymentMethod
const fields = [
  { key: 'name', column: 'Name', type: 'text', label: 'Name', required: true, section: 'principal' },
  { key: 'description', column: 'Description', type: 'textarea', label: 'Description', section: 'principal' },
];
// @sf-generated-end fields:paymentMethod

// @sf-generated-start component:PaymentMethodForm
export default function PaymentMethodForm(props) {
  return <EntityForm fields={fields} {...props} />;
}

// @sf-generated-end component:PaymentMethodForm

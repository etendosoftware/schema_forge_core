import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:paymentMethod
const fields = [
  { key: 'name', column: 'Name', type: 'text', required: true, section: 'principal' },
  { key: 'description', column: 'Description', type: 'textarea', section: 'principal' },
  { key: 'isActive', column: 'IsActive', type: 'checkbox', required: true, readOnly: true, section: 'other' },
];
// @sf-generated-end fields:paymentMethod

// @sf-generated-start component:PaymentMethodForm
export default function PaymentMethodForm(props) {
  // @sf-custom-slot hooks:PaymentMethodForm
  return <EntityForm fields={fields} {...props} />;
}
// @sf-generated-end component:PaymentMethodForm

// @sf-custom-slot section:PaymentMethodForm-custom

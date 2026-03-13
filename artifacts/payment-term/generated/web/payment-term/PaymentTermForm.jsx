import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:paymentTerm
const fields = [
  { key: 'name', column: 'Name', type: 'text', required: true, section: 'principal' },
  { key: 'searchKey', column: 'Value', type: 'text', required: true, section: 'principal' },
  { key: 'description', column: 'Description', type: 'textarea', section: 'principal' },
  { key: 'netDays', column: 'NetDays', type: 'number', required: true, section: 'principal' },
  { key: 'discountDays', column: 'DiscountDays', type: 'number', section: 'other' },
  { key: 'discount', column: 'Discount', type: 'number', section: 'other' },
  { key: 'isActive', column: 'IsActive', type: 'checkbox', required: true, readOnly: true, section: 'other' },
];
// @sf-generated-end fields:paymentTerm

// @sf-generated-start component:PaymentTermForm
export default function PaymentTermForm(props) {
  // @sf-custom-slot hooks:PaymentTermForm
  return <EntityForm fields={fields} {...props} />;
}
// @sf-generated-end component:PaymentTermForm

// @sf-custom-slot section:PaymentTermForm-custom

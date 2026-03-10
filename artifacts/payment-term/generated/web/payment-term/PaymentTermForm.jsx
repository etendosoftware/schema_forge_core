import { EntityForm } from '@/components/contract-ui';

const fields = [
  { key: 'name', column: 'Name', type: 'text', required: true },
  { key: 'searchKey', column: 'Value', type: 'text', required: true },
  { key: 'description', column: 'Description', type: 'textarea' },
  { key: 'netDays', column: 'NetDays', type: 'number', required: true },
  { key: 'discountDays', column: 'DiscountDays', type: 'number' },
  { key: 'discount', column: 'Discount', type: 'number' },
  { key: 'isActive', column: 'IsActive', type: 'checkbox', required: true, readOnly: true },
];

export default function PaymentTermForm(props) {
  return <EntityForm fields={fields} {...props} />;
}

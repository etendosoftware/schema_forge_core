import { EntityForm } from '@/components/contract-ui';

const fields = [
  { key: 'name', label: 'Name', type: 'text', required: true },
  { key: 'searchKey', label: 'Search Key', type: 'text', required: true },
  { key: 'description', label: 'Description', type: 'textarea' },
  { key: 'netDays', label: 'Net Days', type: 'number', required: true },
  { key: 'discountDays', label: 'Discount Days', type: 'number' },
  { key: 'discount', label: 'Discount', type: 'number' },
  { key: 'isActive', label: 'Is Active', type: 'checkbox', required: true, readOnly: true },
];

export default function PaymentTermForm(props) {
  return <EntityForm fields={fields} {...props} />;
}

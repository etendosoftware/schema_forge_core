import { EntityForm } from '@/components/contract-ui';

const fields = [
  { key: 'name', label: 'Name', type: 'text', required: true },
  { key: 'description', label: 'Description', type: 'textarea' },
  { key: 'currency', label: 'Currency', type: 'text', required: true },
  { key: 'isDefault', label: 'Is Default', type: 'checkbox' },
  { key: 'isSalesPrice', label: 'Is Sales Price', type: 'checkbox', readOnly: true },
  { key: 'isActive', label: 'Is Active', type: 'checkbox', required: true, readOnly: true },
];

export default function PriceListForm(props) {
  return <EntityForm fields={fields} {...props} />;
}

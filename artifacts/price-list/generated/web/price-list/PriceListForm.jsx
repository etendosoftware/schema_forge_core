import { EntityForm } from '@/components/contract-ui';

const fields = [
  { key: 'name', label: 'Name', type: 'text', required: true },
  { key: 'description', label: 'Description', type: 'text' },
  { key: 'currency', label: 'Currency', type: 'text', required: true },
  { key: 'isDefault', label: 'Is Default', type: 'text' },
];

export default function PriceListForm(props) {
  return <EntityForm fields={fields} {...props} />;
}

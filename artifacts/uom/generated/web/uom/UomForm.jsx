import { EntityForm } from '@/components/contract-ui';

const fields = [
  { key: 'name', label: 'Name', type: 'text', required: true },
  { key: 'symbol', label: 'Symbol', type: 'text', required: true },
  { key: 'description', label: 'Description', type: 'textarea' },
  { key: 'isActive', label: 'Is Active', type: 'checkbox', required: true, readOnly: true },
];

export default function UomForm(props) {
  return <EntityForm fields={fields} {...props} />;
}

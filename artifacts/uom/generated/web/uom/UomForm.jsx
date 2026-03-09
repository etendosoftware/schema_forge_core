import { EntityForm } from '@/components/contract-ui';

const fields = [
  { key: 'name', label: 'Name', type: 'text', required: true },
  { key: 'symbol', label: 'Symbol', type: 'text', required: true },
  { key: 'description', label: 'Description', type: 'textarea' },
];

export default function UomForm(props) {
  return <EntityForm fields={fields} {...props} />;
}

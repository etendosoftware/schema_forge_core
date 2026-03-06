import { EntityForm } from '@/components/contract-ui';

const fields = [
  { key: 'movementDate', label: 'Movement Date', type: 'date', required: true },
  { key: 'description', label: 'Description', type: 'text' },
  { key: 'isActive', label: 'Is Active', type: 'checkbox', required: true },
];

export default function GoodsMovementForm(props) {
  return <EntityForm fields={fields} {...props} />;
}

import { EntityForm } from '@/components/contract-ui';

const fields = [
  { key: 'movementDate', column: 'MovementDate', type: 'date', required: true },
  { key: 'description', column: 'Description', type: 'textarea' },
  { key: 'isActive', column: 'IsActive', type: 'checkbox', required: true },
  { key: 'documentNo', column: 'DocumentNo', type: 'text', required: true, readOnly: true },
  { key: 'docStatus', column: 'DocStatus', type: 'text', required: true, readOnly: true },
];

export default function GoodsMovementForm(props) {
  return <EntityForm fields={fields} {...props} />;
}

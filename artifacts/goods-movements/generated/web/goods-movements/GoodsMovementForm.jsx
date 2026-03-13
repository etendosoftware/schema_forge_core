import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:goodsMovement
const fields = [
  { key: 'movementDate', column: 'MovementDate', type: 'date', required: true, section: 'principal' },
  { key: 'description', column: 'Description', type: 'textarea', section: 'principal' },
  { key: 'isActive', column: 'IsActive', type: 'checkbox', required: true, section: 'principal' },
  { key: 'documentNo', column: 'DocumentNo', type: 'text', required: true, readOnly: true, section: 'other' },
  { key: 'docStatus', column: 'DocStatus', type: 'text', required: true, readOnly: true, section: 'other' },
];
// @sf-generated-end fields:goodsMovement

// @sf-generated-start component:GoodsMovementForm
export default function GoodsMovementForm(props) {
  // @sf-custom-slot hooks:GoodsMovementForm
  return <EntityForm fields={fields} {...props} />;
}
// @sf-generated-end component:GoodsMovementForm

// @sf-custom-slot section:GoodsMovementForm-custom

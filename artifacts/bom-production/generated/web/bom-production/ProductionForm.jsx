import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:production
const fields = [
  { key: 'documentNo', column: 'DocumentNo', type: 'text', required: true, readOnly: true, section: 'other' },
  { key: 'name', column: 'Name', type: 'text', required: true, section: 'principal' },
  { key: 'movementDate', column: 'MovementDate', type: 'date', required: true, section: 'principal' },
  { key: 'product', column: 'M_Product_ID', type: 'search', required: true, section: 'principal', reference: 'Product', inputMode: 'search' },
  { key: 'productionQuantity', column: 'ProductionQty', type: 'number', required: true, section: 'principal' },
  { key: 'description', column: 'Description', type: 'textarea', section: 'other' },
  { key: 'docStatus', column: 'DocStatus', type: 'text', required: true, readOnly: true, section: 'other' },
];
// @sf-generated-end fields:production

// @sf-generated-start component:ProductionForm
export default function ProductionForm(props) {
  // @sf-custom-slot hooks:ProductionForm
  return <EntityForm fields={fields} {...props} />;
}
// @sf-generated-end component:ProductionForm

// @sf-custom-slot section:ProductionForm-custom

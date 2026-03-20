import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:productionLine
const fields = [
  { key: 'lineNo', column: 'Line', type: 'number', required: true, section: 'principal' },
  { key: 'product', column: 'M_Product_ID', type: 'search', required: true, section: 'principal', reference: 'Product', inputMode: 'search' },
  { key: 'locator', column: 'M_Locator_ID', type: 'selector', required: true, section: 'principal', reference: 'Locator', inputMode: 'selector' },
  { key: 'movementQuantity', column: 'MovementQty', type: 'number', required: true, section: 'principal' },
  { key: 'uom', column: 'C_UOM_ID', type: 'selector', readOnly: true, section: 'other', reference: 'UOM', inputMode: 'selector' },
  { key: 'isEndProduct', column: 'IsEndProduct', type: 'checkbox', required: true, readOnly: true, section: 'other' },
];
// @sf-generated-end fields:productionLine

// @sf-generated-start component:ProductionLineForm
export default function ProductionLineForm(props) {
  // @sf-custom-slot hooks:ProductionLineForm
  return <EntityForm fields={fields} {...props} />;
}
// @sf-generated-end component:ProductionLineForm

// @sf-custom-slot section:ProductionLineForm-custom

import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:customerReturnLine
const fields = [
  { key: 'originalShipmentLine', column: 'M_InOutLine_ID', type: 'selector', required: true, section: 'principal', reference: 'ShipmentLine', inputMode: 'selector' },
  { key: 'quantity', column: 'Qty', type: 'number', required: true, section: 'principal' },
  { key: 'lineNo', column: 'Line', type: 'number', required: true, section: 'principal' },
  { key: 'description', column: 'Description', type: 'textarea', section: 'principal' },
  { key: 'product', column: 'M_Product_ID', type: 'search', readOnly: true, section: 'other', reference: 'Product', inputMode: 'search' },
  { key: 'uom', column: 'C_UOM_ID', type: 'selector', readOnly: true, section: 'other', reference: 'UOM', inputMode: 'selector' },
  { key: 'lineAmount', column: 'Amt', type: 'number', readOnly: true, section: 'other' },
  { key: 'tax', column: 'C_Tax_ID', type: 'selector', readOnly: true, section: 'other', reference: 'Tax', inputMode: 'selector' },
];
// @sf-generated-end fields:customerReturnLine

// @sf-generated-start component:CustomerReturnLineForm
export default function CustomerReturnLineForm(props) {
  // @sf-custom-slot hooks:CustomerReturnLineForm
  return <EntityForm fields={fields} {...props} />;
}
// @sf-generated-end component:CustomerReturnLineForm

// @sf-custom-slot section:CustomerReturnLineForm-custom

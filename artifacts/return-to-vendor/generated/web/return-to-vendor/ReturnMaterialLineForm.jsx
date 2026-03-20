import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:returnMaterialLine
const fields = [
  { key: 'originalReceiptLine', column: 'M_InOutLine_ID', type: 'selector', required: true, section: 'principal', reference: 'MaterialReceiptLine', inputMode: 'selector' },
  { key: 'quantity', column: 'Qty', type: 'number', required: true, section: 'principal' },
  { key: 'lineNo', column: 'Line', type: 'number', required: true, section: 'principal' },
  { key: 'description', column: 'Description', type: 'textarea', section: 'principal' },
  { key: 'product', column: 'M_Product_ID', type: 'search', readOnly: true, section: 'other', reference: 'Product', inputMode: 'search' },
  { key: 'uom', column: 'C_UOM_ID', type: 'selector', readOnly: true, section: 'other', reference: 'UOM', inputMode: 'selector' },
  { key: 'lineAmount', column: 'Amt', type: 'number', readOnly: true, section: 'other' },
  { key: 'tax', column: 'C_Tax_ID', type: 'selector', readOnly: true, section: 'other', reference: 'Tax', inputMode: 'selector' },
];
// @sf-generated-end fields:returnMaterialLine

// @sf-generated-start component:ReturnMaterialLineForm
export default function ReturnMaterialLineForm(props) {
  // @sf-custom-slot hooks:ReturnMaterialLineForm
  return <EntityForm fields={fields} {...props} />;
}
// @sf-generated-end component:ReturnMaterialLineForm

// @sf-custom-slot section:ReturnMaterialLineForm-custom

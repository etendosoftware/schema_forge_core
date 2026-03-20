import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:packingLine
const fields = [
  { key: 'lineNo', column: 'Line', type: 'number', required: true, section: 'principal' },
  { key: 'product', column: 'M_Product_ID', type: 'search', required: true, section: 'principal', reference: 'Product', inputMode: 'search' },
  { key: 'quantity', column: 'Qty', type: 'number', required: true, section: 'principal' },
  { key: 'weight', column: 'Weight', type: 'number', section: 'principal' },
  { key: 'packageNo', column: 'PackageNo', type: 'text', required: true, section: 'other' },
  { key: 'description', column: 'Description', type: 'textarea', section: 'other' },
  { key: 'uom', column: 'C_UOM_ID', type: 'selector', readOnly: true, section: 'other', reference: 'UOM', inputMode: 'selector' },
];
// @sf-generated-end fields:packingLine

// @sf-generated-start component:PackingLineForm
export default function PackingLineForm(props) {
  // @sf-custom-slot hooks:PackingLineForm
  return <EntityForm fields={fields} {...props} />;
}
// @sf-generated-end component:PackingLineForm

// @sf-custom-slot section:PackingLineForm-custom

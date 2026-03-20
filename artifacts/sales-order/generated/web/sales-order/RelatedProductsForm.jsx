import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:relatedProducts
const fields = [
  { key: 'lineNo', column: 'Line', type: 'number', label: 'Line No.', required: true, readOnly: true, section: 'other' },
  // @sf-custom-slot callout:SL_Order_Product
  { key: 'product', column: 'M_Product_ID', type: 'search', label: 'Product', required: true, readOnly: true, section: 'other', reference: 'Product', inputMode: 'search' },
  // @sf-custom-slot callout:SL_Order_Amt
  { key: 'attributeSetValue', column: 'M_AttributeSetInstance_ID', type: 'text', label: 'Attribute Set Value', readOnly: true, section: 'other' },
];
// @sf-generated-end fields:relatedProducts

// @sf-generated-start component:RelatedProductsForm
export default function RelatedProductsForm(props) {
  // @sf-custom-slot hooks:RelatedProductsForm
  return <EntityForm fields={fields} {...props} />;
}
// @sf-generated-end component:RelatedProductsForm

// @sf-custom-slot section:RelatedProductsForm-custom

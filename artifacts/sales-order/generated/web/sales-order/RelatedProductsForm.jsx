import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:relatedProducts
const fields = [
  { key: 'lineNo', column: 'Line', type: 'number', required: true, readOnly: true },
  { key: 'product', column: 'M_Product_ID', type: 'search', required: true, readOnly: true, reference: 'Product', inputMode: 'search' },
  { key: 'attributeSetValue', column: 'M_AttributeSetInstance_ID', type: 'text', readOnly: true },
];
// @sf-generated-end fields:relatedProducts

// @sf-generated-start component:RelatedProductsForm
export default function RelatedProductsForm(props) {
  // @sf-custom-slot hooks:RelatedProductsForm
  return <EntityForm fields={fields} {...props} />;
}
// @sf-generated-end component:RelatedProductsForm

// @sf-custom-slot section:RelatedProductsForm-custom

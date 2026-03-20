import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:relatedServices
const fields = [
  { key: 'documentNo', column: 'documentNo', type: 'text', label: 'Document No.', readOnly: true, section: 'other' },
  { key: 'lineNo', column: 'lineNo', type: 'number', label: 'Line No.', readOnly: true, section: 'other' },
  { key: 'product', column: 'product', type: 'search', label: 'Product', required: true, readOnly: true, section: 'other', reference: 'Product', inputMode: 'search' },
  { key: 'attributeSetValue', column: 'attributeSetValue', type: 'text', label: 'Attribute Set Value', readOnly: true, section: 'other' },
  { key: 'amount', column: 'amount', type: 'number', label: 'Amount', required: true, readOnly: true, section: 'other' },
  { key: 'quantity', column: 'quantity', type: 'text', label: 'Quantity', required: true, readOnly: true, section: 'other' },
];
// @sf-generated-end fields:relatedServices

// @sf-generated-start component:RelatedServicesForm
export default function RelatedServicesForm(props) {
  // @sf-custom-slot hooks:RelatedServicesForm
  return <EntityForm fields={fields} {...props} />;
}
// @sf-generated-end component:RelatedServicesForm

// @sf-custom-slot section:RelatedServicesForm-custom

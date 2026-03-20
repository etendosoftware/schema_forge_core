import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:orderLineTax
const fields = [
  { key: 'lineNo', column: 'Line', type: 'number', label: 'Line No.', readOnly: true, section: 'other' },
  { key: 'tax', column: 'C_Tax_ID', type: 'search', label: 'Tax', required: true, readOnly: true, section: 'other', reference: 'Tax' },
  { key: 'taxableAmount', column: 'Taxbaseamt', type: 'number', label: 'Taxable Amount', required: true, readOnly: true, section: 'other' },
  { key: 'taxAmount', column: 'Taxamt', type: 'number', label: 'Tax Amount', required: true, readOnly: true, section: 'other' },
];
// @sf-generated-end fields:orderLineTax

// @sf-generated-start component:OrderLineTaxForm
export default function OrderLineTaxForm(props) {
  // @sf-custom-slot hooks:OrderLineTaxForm
  return <EntityForm fields={fields} {...props} />;
}
// @sf-generated-end component:OrderLineTaxForm

// @sf-custom-slot section:OrderLineTaxForm-custom

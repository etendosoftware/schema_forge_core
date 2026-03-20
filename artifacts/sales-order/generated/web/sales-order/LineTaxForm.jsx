import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:lineTax
const fields = [
  { key: 'lineNo', column: 'Line', type: 'number', readOnly: true, section: 'other' },
  { key: 'tax', column: 'C_Tax_ID', type: 'selector', required: true, readOnly: true, section: 'other', reference: 'Tax', inputMode: 'selector' },
  { key: 'taxableAmount', column: 'Taxbaseamt', type: 'number', required: true, readOnly: true, section: 'other' },
  { key: 'taxAmount', column: 'Taxamt', type: 'number', required: true, readOnly: true, section: 'other' },
];
// @sf-generated-end fields:lineTax

// @sf-generated-start component:LineTaxForm
export default function LineTaxForm(props) {
  // @sf-custom-slot hooks:LineTaxForm
  return <EntityForm fields={fields} {...props} />;
}
// @sf-generated-end component:LineTaxForm

// @sf-custom-slot section:LineTaxForm-custom

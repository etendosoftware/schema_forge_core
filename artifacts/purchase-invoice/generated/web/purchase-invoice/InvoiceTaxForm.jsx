import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:invoiceTax
const fields = [
  { key: 'lineNo', column: 'Line', type: 'number', readOnly: true, section: 'other' },
  { key: 'tax', column: 'C_Tax_ID', type: 'selector', readOnly: true, section: 'other', reference: 'Tax', inputMode: 'selector' },
  { key: 'taxableAmount', column: 'TaxBaseAmt', type: 'number', readOnly: true, section: 'other' },
  { key: 'taxAmount', column: 'TaxAmt', type: 'number', readOnly: true, section: 'other' },
];
// @sf-generated-end fields:invoiceTax

// @sf-generated-start component:InvoiceTaxForm
export default function InvoiceTaxForm(props) {
  // @sf-custom-slot hooks:InvoiceTaxForm
  return <EntityForm fields={fields} {...props} />;
}
// @sf-generated-end component:InvoiceTaxForm

// @sf-custom-slot section:InvoiceTaxForm-custom

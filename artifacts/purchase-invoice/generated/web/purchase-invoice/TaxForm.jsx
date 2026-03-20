import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:tax
const fields = [
  { key: 'lineNo', column: 'Line', type: 'number', readOnly: true, section: 'other' },
  { key: 'tax', column: 'C_Tax_ID', type: 'selector', required: true, readOnly: true, section: 'other', reference: 'Tax', inputMode: 'selector' },
  // @sf-custom-slot callout:SL_InvoiceTax_Amt
  { key: 'taxAmount', column: 'TaxAmt', type: 'number', required: true, readOnly: true, section: 'other' },
  // @sf-custom-slot callout:SL_InvoiceTax_Amt
  { key: 'taxableAmount', column: 'TaxBaseAmt', type: 'number', required: true, readOnly: true, section: 'other' },
];
// @sf-generated-end fields:tax

// @sf-generated-start component:TaxForm
export default function TaxForm(props) {
  // @sf-custom-slot hooks:TaxForm
  return <EntityForm fields={fields} {...props} />;
}
// @sf-generated-end component:TaxForm

// @sf-custom-slot section:TaxForm-custom

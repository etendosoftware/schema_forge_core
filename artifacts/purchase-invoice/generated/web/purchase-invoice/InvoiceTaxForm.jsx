import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:invoiceTax
const fields = [
  { key: 'lineNo', column: 'Line', type: 'number', label: 'Line No.', section: 'principal' },
  { key: 'tax', column: 'C_Tax_ID', type: 'selector', label: 'Tax', required: true, section: 'principal', reference: 'Tax', inputMode: 'selector' },
  // @sf-custom-slot callout:SL_InvoiceTax_Amt
  { key: 'taxAmount', column: 'TaxAmt', type: 'number', label: 'Tax Amount', required: true, section: 'principal' },
  // @sf-custom-slot callout:SL_InvoiceTax_Amt
  { key: 'taxableAmount', column: 'TaxBaseAmt', type: 'number', label: 'Taxable Amount', required: true, section: 'principal' },
  { key: 'recalculate', column: 'Recalculate', type: 'checkbox', label: 'Recalculate', required: true, readOnly: true, section: 'other' },
];
// @sf-generated-end fields:invoiceTax

// @sf-generated-start component:InvoiceTaxForm
export default function InvoiceTaxForm(props) {
  // @sf-custom-slot hooks:InvoiceTaxForm
  return <EntityForm fields={fields} {...props} />;
}
// @sf-generated-end component:InvoiceTaxForm

// @sf-custom-slot section:InvoiceTaxForm-custom

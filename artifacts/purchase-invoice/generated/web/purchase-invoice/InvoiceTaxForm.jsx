import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:invoiceTax
const fields = [
  { key: 'line', column: 'Line', type: 'number', section: 'principal' },
  { key: 'cTaxId', column: 'C_Tax_ID', type: 'selector', required: true, section: 'principal', reference: 'Tax', inputMode: 'selector' },
  // @sf-custom-slot callout:SL_InvoiceTax_Amt
  { key: 'taxAmt', column: 'TaxAmt', type: 'number', required: true, section: 'principal' },
  // @sf-custom-slot callout:SL_InvoiceTax_Amt
  { key: 'taxBaseAmt', column: 'TaxBaseAmt', type: 'number', required: true, section: 'principal' },
  { key: 'recalculate', column: 'Recalculate', type: 'checkbox', required: true, readOnly: true, section: 'other' },
];
// @sf-generated-end fields:invoiceTax

// @sf-generated-start component:InvoiceTaxForm
export default function InvoiceTaxForm(props) {
  // @sf-custom-slot hooks:InvoiceTaxForm
  return <EntityForm fields={fields} {...props} />;
}
// @sf-generated-end component:InvoiceTaxForm

// @sf-custom-slot section:InvoiceTaxForm-custom

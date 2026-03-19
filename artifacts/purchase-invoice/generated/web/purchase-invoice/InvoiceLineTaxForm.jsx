import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:invoiceLineTax
const fields = [
  { key: 'isactive', column: 'Isactive', type: 'checkbox', required: true, section: 'principal' },
  { key: 'line', column: 'Line', type: 'number', required: true, section: 'principal' },
  { key: 'cTaxId', column: 'C_Tax_ID', type: 'selector', required: true, section: 'principal', reference: 'Tax', inputMode: 'selector' },
  { key: 'taxbaseamt', column: 'Taxbaseamt', type: 'number', required: true, section: 'principal' },
  { key: 'taxamt', column: 'Taxamt', type: 'number', required: true, section: 'other' },
];
// @sf-generated-end fields:invoiceLineTax

// @sf-generated-start component:InvoiceLineTaxForm
export default function InvoiceLineTaxForm(props) {
  // @sf-custom-slot hooks:InvoiceLineTaxForm
  return <EntityForm fields={fields} {...props} />;
}
// @sf-generated-end component:InvoiceLineTaxForm

// @sf-custom-slot section:InvoiceLineTaxForm-custom

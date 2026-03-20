import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:orderTax
const fields = [
  { key: 'lineNo', column: 'Line', type: 'number', label: 'Line No.', readOnly: true, section: 'other' },
  { key: 'tax', column: 'C_Tax_ID', type: 'search', label: 'Tax', required: true, readOnly: true, section: 'other', reference: 'Tax' },
  { key: 'taxAmount', column: 'TaxAmt', type: 'number', label: 'Tax Amount', required: true, readOnly: true, section: 'other' },
  { key: 'taxableAmount', column: 'TaxBaseAmt', type: 'number', label: 'Taxable Amount', required: true, readOnly: true, section: 'other' },
];
// @sf-generated-end fields:orderTax

// @sf-generated-start component:OrderTaxForm
export default function OrderTaxForm(props) {
  // @sf-custom-slot hooks:OrderTaxForm
  return <EntityForm fields={fields} {...props} />;
}
// @sf-generated-end component:OrderTaxForm

// @sf-custom-slot section:OrderTaxForm-custom

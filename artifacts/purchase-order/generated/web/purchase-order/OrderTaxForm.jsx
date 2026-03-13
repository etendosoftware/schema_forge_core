import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:orderTax
const fields = [
  { key: 'lineNo', column: 'Line', type: 'number', readOnly: true },
  { key: 'tax', column: 'C_Tax_ID', type: 'search', required: true, readOnly: true, reference: 'Tax' },
  { key: 'taxableAmount', column: 'TaxBaseAmt', type: 'number', required: true, readOnly: true },
  { key: 'taxAmount', column: 'TaxAmt', type: 'number', required: true, readOnly: true },
];
// @sf-generated-end fields:orderTax

// @sf-generated-start component:OrderTaxForm
export default function OrderTaxForm(props) {
  // @sf-custom-slot hooks:OrderTaxForm
  return <EntityForm fields={fields} {...props} />;
}
// @sf-generated-end component:OrderTaxForm

// @sf-custom-slot section:OrderTaxForm-custom

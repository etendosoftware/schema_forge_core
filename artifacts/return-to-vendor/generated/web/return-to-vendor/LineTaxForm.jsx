import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:lineTax
const fields = [
  { key: 'lineNo', column: 'Line', type: 'number', label: 'Line No.', section: 'principal', defaultValue: '@SQL=SELECT COALESCE(MAX(LINE),0)+10 AS DefaultValue FROM C_ORDERLINETAX WHERE C_ORDERLINE_ID=@C_OrderLine_ID@' },
  { key: 'tax', column: 'C_Tax_ID', type: 'selector', label: 'Tax', required: true, section: 'principal', reference: 'Tax', inputMode: 'selector' },
  { key: 'taxableAmount', column: 'Taxbaseamt', type: 'number', label: 'Taxable Amount', required: true, section: 'principal', defaultValue: '0' },
  { key: 'taxAmount', column: 'Taxamt', type: 'number', label: 'Tax Amount', required: true, section: 'principal', defaultValue: '0' },
];
// @sf-generated-end fields:lineTax

// @sf-generated-start component:LineTaxForm
export default function LineTaxForm(props) {
  return <EntityForm fields={fields} {...props} />;
}

// @sf-generated-end component:LineTaxForm

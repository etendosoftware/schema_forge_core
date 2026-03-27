import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:amortizationLine
const fields = [
  { key: 'sEQNoAsset', column: 'SEQ_No_Asset', type: 'number', readOnly: true, section: 'other', defaultValue: '@SQL=SELECT COALESCE(MAX(SEQ_No_Asset),0)+10 AS DefaultValue FROM A_AMORTIZATIONLINE WHERE A_ASSET_ID=@A_ASSET_ID@' },
  { key: 'amortization', column: 'A_Amortization_ID', type: 'search', readOnly: true, section: 'other', reference: 'Amortization', inputMode: 'search' },
  { key: 'amortizationPercentage', column: 'Amortization_Percentage', type: 'number', section: 'principal' },
  { key: 'amortizationAmount', column: 'Amortizationamt', type: 'number', section: 'principal' },
  { key: 'currency', column: 'C_Currency_ID', type: 'selector', section: 'principal', reference: 'Currency', inputMode: 'selector' },
];
// @sf-generated-end fields:amortizationLine

// @sf-generated-start component:AmortizationLineForm
export default function AmortizationLineForm(props) {
  // @sf-custom-slot hooks:AmortizationLineForm
  return <EntityForm fields={fields} {...props} />;
}
// @sf-generated-end component:AmortizationLineForm

// @sf-custom-slot section:AmortizationLineForm-custom

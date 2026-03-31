import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:exchangeRates
const fields = [
  { key: 'active', column: 'Isactive', type: 'checkbox', required: true, section: 'principal' },
  { key: 'currency', column: 'C_Currency_ID', type: 'selector', required: true, readOnly: true, section: 'other', reference: 'Currency', inputMode: 'selector' },
  { key: 'toCurrency', column: 'C_Currency_Id_To', type: 'search', required: true, section: 'principal', reference: 'Currency', inputMode: 'search' },
  // @sf-custom-slot callout:SE_CalculateExchangeRate
  { key: 'rate', column: 'Rate', type: 'text', section: 'principal' },
  // @sf-custom-slot callout:SE_CalculateExchangeRate
  { key: 'foreignAmount', column: 'Foreign_Amount', type: 'number', required: true, section: 'principal' },
];
// @sf-generated-end fields:exchangeRates

// @sf-generated-start component:ExchangeRatesForm
export default function ExchangeRatesForm(props) {
  // @sf-custom-slot hooks:ExchangeRatesForm
  return <EntityForm fields={fields} {...props} />;
}
// @sf-generated-end component:ExchangeRatesForm

// @sf-custom-slot section:ExchangeRatesForm-custom

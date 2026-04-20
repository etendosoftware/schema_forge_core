import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:exchangeRates
const fields = [
  { key: 'active', column: 'Isactive', type: 'checkbox', label: 'Active', required: true, section: 'principal', defaultValue: 'Y', readOnlyLogic: (record) => record['hASREVERSEDINVOICESO'] === 'Y' || record['hASREVERSEDINVOICEPO'] === 'Y' || record['posted'] === 'Y' },
  { key: 'currency', column: 'C_Currency_ID', type: 'selector', label: 'Currency', required: true, readOnly: true, section: 'other', reference: 'Currency', inputMode: 'selector', readOnlyLogic: (record) => record['hASREVERSEDINVOICESO'] === 'Y' || record['hASREVERSEDINVOICEPO'] === 'Y' || record['posted'] === 'Y' },
  { key: 'toCurrency', column: 'C_Currency_Id_To', type: 'search', label: 'To Currency', required: true, section: 'principal', reference: 'Currency', inputMode: 'search' },
  { key: 'rate', column: 'Rate', type: 'text', label: 'Rate', section: 'principal' },
  { key: 'foreignAmount', column: 'Foreign_Amount', type: 'number', label: 'Foreign  Amount', required: true, section: 'principal', defaultValue: '0' },
];
// @sf-generated-end fields:exchangeRates

// @sf-generated-start component:ExchangeRatesForm
export default function ExchangeRatesForm(props) {
  return <EntityForm fields={fields} {...props} />;
}
ExchangeRatesForm.hasCollapsedFields = false;
// @sf-generated-end component:ExchangeRatesForm

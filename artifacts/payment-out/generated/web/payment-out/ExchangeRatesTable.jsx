import { DataTable } from '@/components/contract-ui';

// @sf-generated-start columns:exchangeRates
const columns = [
  { key: 'currency', column: 'C_Currency_ID', type: 'string' },
  { key: 'toCurrency', column: 'C_Currency_Id_To', type: 'string' },
  { key: 'rate', column: 'Rate', type: 'string' },
  { key: 'foreignAmount', column: 'Foreign_Amount', type: 'amount' },
];
// @sf-generated-end columns:exchangeRates

const filters = [];

// @sf-generated-start component:ExchangeRatesTable
export default function ExchangeRatesTable(props) {
  // @sf-custom-slot hooks:ExchangeRatesTable
  return <DataTable columns={columns} filters={filters} {...props} />;
}
// @sf-generated-end component:ExchangeRatesTable

// @sf-custom-slot section:ExchangeRatesTable-custom

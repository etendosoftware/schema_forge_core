import { DataTable } from '@/components/contract-ui';

// @sf-generated-start columns:priceList
const columns = [
  { key: 'name', column: 'Name', type: 'string', label: 'Name' },
  { key: 'currency', column: 'C_Currency_ID', type: 'string', label: 'Currency' },
  { key: 'salesPriceList', column: 'IsSOPriceList', type: 'boolean', labels: { es_ES: 'Tipo', en_US: 'Type' }, label: 'Type', badge: true, badgeLabels: { true: { es_ES: 'Venta', en_US: 'Sales' }, false: { es_ES: 'Compra', en_US: 'Purchase' } }, badgeColors: { true: 'bg-emerald-100 text-emerald-800', false: 'bg-indigo-100 text-indigo-700' } },
];
// @sf-generated-end columns:priceList

const filters = ['name'];

// @sf-generated-start component:PriceListTable
export default function PriceListTable(props) {
  return <DataTable columns={columns} filters={filters} {...props} />;
}
// @sf-generated-end component:PriceListTable

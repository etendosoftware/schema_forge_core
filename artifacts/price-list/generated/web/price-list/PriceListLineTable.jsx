import { DataTable } from '@/components/contract-ui';

// @sf-generated-start columns:priceListLine
const columns = [
  { key: 'product', column: 'M_Product_ID', type: 'string' },
  { key: 'listPrice', column: 'PriceList', type: 'amount' },
  { key: 'standardPrice', column: 'PriceStd', type: 'amount' },
  { key: 'limitPrice', column: 'PriceLimit', type: 'amount' },
  { key: 'uom', column: 'C_UOM_ID', type: 'string' },
];
// @sf-generated-end columns:priceListLine

const filters = ['product'];

// @sf-generated-start component:PriceListLineTable
export default function PriceListLineTable(props) {
  return <DataTable columns={columns} filters={filters} {...props} showFooterTotals={false} />;
}
// @sf-generated-end component:PriceListLineTable

import { DataTable } from '@/components/contract-ui';

const columns = [
  { key: 'product', column: 'M_Product_ID', type: 'string' },
  { key: 'listPrice', column: 'PriceList', type: 'amount' },
  { key: 'standardPrice', column: 'PriceStd', type: 'amount' },
  { key: 'limitPrice', column: 'PriceLimit', type: 'amount' },
  { key: 'uom', column: 'C_UOM_ID', type: 'string' },
];

const filters = ['product'];

export default function PriceListLineTable(props) {
  return <DataTable columns={columns} filters={filters} {...props} />;
}

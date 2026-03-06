import { DataTable } from '@/components/contract-ui';

const columns = [
  { key: 'product', label: 'Product', type: 'string' },
  { key: 'listPrice', label: 'List Price', type: 'amount' },
  { key: 'standardPrice', label: 'Standard Price', type: 'amount' },
  { key: 'limitPrice', label: 'Limit Price', type: 'amount' },
  { key: 'uom', label: 'Uom', type: 'string' },
];

const filters = ['product'];

export default function PriceListLineTable(props) {
  return <DataTable columns={columns} filters={filters} {...props} />;
}

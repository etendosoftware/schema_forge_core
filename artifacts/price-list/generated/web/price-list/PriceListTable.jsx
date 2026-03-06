import { DataTable } from '@/components/contract-ui';

const columns = [
  { key: 'name', label: 'Name', type: 'string' },
  { key: 'currency', label: 'Currency', type: 'string' },
  { key: 'isSalesPrice', label: 'Is Sales Price', type: 'boolean' },
  { key: 'isActive', label: 'Is Active', type: 'boolean' },
];

const filters = ['name'];

export default function PriceListTable(props) {
  return <DataTable columns={columns} filters={filters} {...props} />;
}

import { DataTable } from '@/components/contract-ui';

const columns = [
  { key: 'name', column: 'Name', type: 'string' },
  { key: 'currency', column: 'C_Currency_ID', type: 'string' },
  { key: 'isSalesPrice', column: 'IsSOPriceList', type: 'boolean' },
  { key: 'isActive', column: 'IsActive', type: 'boolean' },
];

const filters = ['name'];

export default function PriceListTable(props) {
  return <DataTable columns={columns} filters={filters} {...props} />;
}

import { DataTable } from '@/components/contract-ui';

const columns = [
  { key: 'name', label: 'Name', type: 'string' },
  { key: 'searchKey', label: 'Search Key', type: 'string' },
  { key: 'isActive', label: 'Is Active', type: 'boolean' },
];

const filters = ['name', 'searchKey'];

export default function BusinessPartnerTable(props) {
  return <DataTable columns={columns} filters={filters} {...props} />;
}

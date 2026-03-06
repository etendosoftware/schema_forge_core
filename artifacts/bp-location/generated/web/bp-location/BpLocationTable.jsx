import { DataTable } from '@/components/contract-ui';

const columns = [
  { key: 'name', label: 'Name', type: 'string' },
  { key: 'city', label: 'City', type: 'string' },
  { key: 'country', label: 'Country', type: 'string' },
  { key: 'businessPartner', label: 'Business Partner', type: 'string' },
];

const filters = ['name', 'city', 'businessPartner'];

export default function BpLocationTable(props) {
  return <DataTable columns={columns} filters={filters} {...props} />;
}

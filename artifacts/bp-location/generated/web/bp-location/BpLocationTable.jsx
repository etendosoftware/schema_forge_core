import { DataTable } from '@/components/contract-ui';

const columns = [
  { key: 'name', column: 'Name', type: 'string' },
  { key: 'city', column: 'City', type: 'string' },
  { key: 'country', column: 'C_Country_ID', type: 'string' },
  { key: 'businessPartner', column: 'C_BPartner_ID', type: 'string' },
];

const filters = ['name', 'city', 'businessPartner'];

export default function BpLocationTable(props) {
  return <DataTable columns={columns} filters={filters} {...props} />;
}

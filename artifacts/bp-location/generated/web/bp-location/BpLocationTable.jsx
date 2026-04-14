import { DataTable } from '@/components/contract-ui';

// @sf-generated-start columns:bpLocation
const columns = [
  { key: 'name', column: 'Name', type: 'string' },
  { key: 'city', column: 'City', type: 'string' },
  { key: 'country', column: 'C_Country_ID', type: 'string' },
  { key: 'businessPartner', column: 'C_BPartner_ID', type: 'string' },
];
// @sf-generated-end columns:bpLocation

const filters = ['name', 'city', 'businessPartner'];

// @sf-generated-start component:BpLocationTable
export default function BpLocationTable(props) {
  return <DataTable columns={columns} filters={filters} {...props} />;
}
// @sf-generated-end component:BpLocationTable

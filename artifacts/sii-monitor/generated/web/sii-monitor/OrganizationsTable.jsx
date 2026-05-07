import { DataTable } from '@/components/contract-ui';

// @sf-generated-start columns:organizations
const columns = [

];
// @sf-generated-end columns:organizations

const filters = [];

// @sf-generated-start component:OrganizationsTable
export default function OrganizationsTable(props) {
  return <DataTable columns={columns} filters={filters} {...props} />;
}
// @sf-generated-end component:OrganizationsTable

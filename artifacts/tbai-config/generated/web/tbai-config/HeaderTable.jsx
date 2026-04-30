import { DataTable } from '@/components/contract-ui';

// @sf-generated-start columns:header
const columns = [

];
// @sf-generated-end columns:header

const filters = [];

// @sf-generated-start component:HeaderTable
export default function HeaderTable(props) {
  return <DataTable columns={columns} filters={filters} {...props} />;
}
// @sf-generated-end component:HeaderTable

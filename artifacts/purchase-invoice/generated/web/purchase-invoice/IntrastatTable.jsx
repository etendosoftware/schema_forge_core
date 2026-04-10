import { DataTable } from '@/components/contract-ui';

// @sf-generated-start columns:intrastat
const columns = [

];
// @sf-generated-end columns:intrastat

const filters = [];

// @sf-generated-start component:IntrastatTable
export default function IntrastatTable(props) {
  return <DataTable columns={columns} filters={filters} {...props} />;
}
// @sf-generated-end component:IntrastatTable

import { DataTable } from '@/components/contract-ui';

// @sf-generated-start columns:employeeAccounting
const columns = [

];
// @sf-generated-end columns:employeeAccounting

const filters = [];

// @sf-generated-start component:EmployeeAccountingTable
export default function EmployeeAccountingTable(props) {
  return <DataTable columns={columns} filters={filters} {...props} />;
}
// @sf-generated-end component:EmployeeAccountingTable

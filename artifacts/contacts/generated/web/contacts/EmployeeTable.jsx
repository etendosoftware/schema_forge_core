import { DataTable } from '@/components/contract-ui';

// @sf-generated-start columns:employee
const columns = [

];
// @sf-generated-end columns:employee

const filters = [];

// @sf-generated-start component:EmployeeTable
export default function EmployeeTable(props) {
  return <DataTable columns={columns} filters={filters} {...props} />;
}
// @sf-generated-end component:EmployeeTable

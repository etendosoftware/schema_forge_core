import { DataTable } from '@/components/contract-ui';

// @sf-generated-start columns:issuedInvoices
const columns = [

];
// @sf-generated-end columns:issuedInvoices

const filters = [];

// @sf-generated-start component:IssuedInvoicesTable
export default function IssuedInvoicesTable(props) {
  return <DataTable columns={columns} filters={filters} {...props} />;
}
// @sf-generated-end component:IssuedInvoicesTable

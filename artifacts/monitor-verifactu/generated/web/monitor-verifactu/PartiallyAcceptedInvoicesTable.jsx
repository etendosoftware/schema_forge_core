import { DataTable } from '@/components/contract-ui';

// @sf-generated-start columns:partiallyAcceptedInvoices
const columns = [

];
// @sf-generated-end columns:partiallyAcceptedInvoices

const filters = [];

// @sf-generated-start component:PartiallyAcceptedInvoicesTable
export default function PartiallyAcceptedInvoicesTable(props) {
  return <DataTable columns={columns} filters={filters} {...props} />;
}
// @sf-generated-end component:PartiallyAcceptedInvoicesTable

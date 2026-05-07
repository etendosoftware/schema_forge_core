import { DataTable } from '@/components/contract-ui';

// @sf-generated-start columns:receivedInvoices
const columns = [

];
// @sf-generated-end columns:receivedInvoices

const filters = [];

// @sf-generated-start component:ReceivedInvoicesTable
export default function ReceivedInvoicesTable(props) {
  return <DataTable columns={columns} filters={filters} {...props} />;
}
// @sf-generated-end component:ReceivedInvoicesTable

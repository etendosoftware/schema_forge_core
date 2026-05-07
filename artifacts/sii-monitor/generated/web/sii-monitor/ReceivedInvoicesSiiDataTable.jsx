import { DataTable } from '@/components/contract-ui';

// @sf-generated-start columns:receivedInvoicesSiiData
const columns = [

];
// @sf-generated-end columns:receivedInvoicesSiiData

const filters = [];

// @sf-generated-start component:ReceivedInvoicesSiiDataTable
export default function ReceivedInvoicesSiiDataTable(props) {
  return <DataTable columns={columns} filters={filters} {...props} />;
}
// @sf-generated-end component:ReceivedInvoicesSiiDataTable

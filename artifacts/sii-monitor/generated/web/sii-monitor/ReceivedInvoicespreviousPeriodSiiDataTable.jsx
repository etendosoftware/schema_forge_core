import { DataTable } from '@/components/contract-ui';

// @sf-generated-start columns:receivedInvoices(previousPeriod)SiiData
const columns = [

];
// @sf-generated-end columns:receivedInvoices(previousPeriod)SiiData

const filters = [];

// @sf-generated-start component:ReceivedInvoicespreviousPeriodSiiDataTable
export default function ReceivedInvoicespreviousPeriodSiiDataTable(props) {
  return <DataTable columns={columns} filters={filters} {...props} />;
}
// @sf-generated-end component:ReceivedInvoicespreviousPeriodSiiDataTable

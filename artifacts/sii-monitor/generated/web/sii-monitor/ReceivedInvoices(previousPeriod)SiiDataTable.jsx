import { DataTable } from '@/components/contract-ui';

// @sf-generated-start columns:receivedInvoices(previousPeriod)SiiData
const columns = [

];
// @sf-generated-end columns:receivedInvoices(previousPeriod)SiiData

const filters = [];

// @sf-generated-start component:ReceivedInvoices(previousPeriod)SiiDataTable
export default function ReceivedInvoices(previousPeriod)SiiDataTable(props) {
  return <DataTable columns={columns} filters={filters} {...props} />;
}
// @sf-generated-end component:ReceivedInvoices(previousPeriod)SiiDataTable

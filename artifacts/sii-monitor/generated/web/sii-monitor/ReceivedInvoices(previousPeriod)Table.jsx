import { DataTable } from '@/components/contract-ui';

// @sf-generated-start columns:receivedInvoices(previousPeriod)
const columns = [

];
// @sf-generated-end columns:receivedInvoices(previousPeriod)

const filters = [];

// @sf-generated-start component:ReceivedInvoices(previousPeriod)Table
export default function ReceivedInvoices(previousPeriod)Table(props) {
  return <DataTable columns={columns} filters={filters} {...props} />;
}
// @sf-generated-end component:ReceivedInvoices(previousPeriod)Table

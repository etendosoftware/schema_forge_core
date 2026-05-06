import { DataTable } from '@/components/contract-ui';

// @sf-generated-start columns:issuedInvoices(previousPeriod)
const columns = [

];
// @sf-generated-end columns:issuedInvoices(previousPeriod)

const filters = [];

// @sf-generated-start component:IssuedInvoices(previousPeriod)Table
export default function IssuedInvoices(previousPeriod)Table(props) {
  return <DataTable columns={columns} filters={filters} {...props} />;
}
// @sf-generated-end component:IssuedInvoices(previousPeriod)Table

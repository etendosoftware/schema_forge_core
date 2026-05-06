import { DataTable } from '@/components/contract-ui';

// @sf-generated-start columns:issuedInvoices(previousPeriod)SiiData
const columns = [

];
// @sf-generated-end columns:issuedInvoices(previousPeriod)SiiData

const filters = [];

// @sf-generated-start component:IssuedInvoices(previousPeriod)SiiDataTable
export default function IssuedInvoices(previousPeriod)SiiDataTable(props) {
  return <DataTable columns={columns} filters={filters} {...props} />;
}
// @sf-generated-end component:IssuedInvoices(previousPeriod)SiiDataTable

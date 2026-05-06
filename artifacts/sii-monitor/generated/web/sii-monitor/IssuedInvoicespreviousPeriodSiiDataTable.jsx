import { DataTable } from '@/components/contract-ui';

// @sf-generated-start columns:issuedInvoices(previousPeriod)SiiData
const columns = [

];
// @sf-generated-end columns:issuedInvoices(previousPeriod)SiiData

const filters = [];

// @sf-generated-start component:IssuedInvoicespreviousPeriodSiiDataTable
export default function IssuedInvoicespreviousPeriodSiiDataTable(props) {
  return <DataTable columns={columns} filters={filters} {...props} />;
}
// @sf-generated-end component:IssuedInvoicespreviousPeriodSiiDataTable

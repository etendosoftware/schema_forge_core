import { DataTable } from '@/components/contract-ui';

// @sf-generated-start columns:issuedInvoicesSiiData
const columns = [

];
// @sf-generated-end columns:issuedInvoicesSiiData

const filters = [];

// @sf-generated-start component:IssuedInvoicesSiiDataTable
export default function IssuedInvoicesSiiDataTable(props) {
  return <DataTable columns={columns} filters={filters} {...props} />;
}
// @sf-generated-end component:IssuedInvoicesSiiDataTable

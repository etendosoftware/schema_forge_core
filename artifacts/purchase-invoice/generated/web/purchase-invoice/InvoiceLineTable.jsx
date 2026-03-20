import { DataTable } from '@/components/contract-ui';

// @sf-generated-start columns:invoiceLine
const columns = [

];
// @sf-generated-end columns:invoiceLine

const filters = [];

// @sf-generated-start component:InvoiceLineTable
export default function InvoiceLineTable(props) {
  // @sf-custom-slot hooks:InvoiceLineTable
  return <DataTable columns={columns} filters={filters} {...props} />;
}
// @sf-generated-end component:InvoiceLineTable

// @sf-custom-slot section:InvoiceLineTable-custom

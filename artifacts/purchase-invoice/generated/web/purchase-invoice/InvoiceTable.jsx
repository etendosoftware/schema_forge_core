import { DataTable } from '@/components/contract-ui';

// @sf-generated-start columns:invoice
const columns = [

];
// @sf-generated-end columns:invoice

const filters = [];

// @sf-generated-start component:InvoiceTable
export default function InvoiceTable(props) {
  // @sf-custom-slot hooks:InvoiceTable
  return <DataTable columns={columns} filters={filters} {...props} />;
}
// @sf-generated-end component:InvoiceTable

// @sf-custom-slot section:InvoiceTable-custom

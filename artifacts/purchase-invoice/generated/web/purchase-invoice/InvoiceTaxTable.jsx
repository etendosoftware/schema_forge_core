import { DataTable } from '@/components/contract-ui';

// @sf-generated-start columns:invoiceTax
const columns = [

];
// @sf-generated-end columns:invoiceTax

const filters = [];

// @sf-generated-start component:InvoiceTaxTable
export default function InvoiceTaxTable(props) {
  // @sf-custom-slot hooks:InvoiceTaxTable
  return <DataTable columns={columns} filters={filters} {...props} />;
}
// @sf-generated-end component:InvoiceTaxTable

// @sf-custom-slot section:InvoiceTaxTable-custom

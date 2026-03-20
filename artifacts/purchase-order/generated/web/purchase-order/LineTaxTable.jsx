import { DataTable } from '@/components/contract-ui';

// @sf-generated-start columns:lineTax
const columns = [
  { key: 'lineNo', column: 'Line', type: 'number' },
  { key: 'tax', column: 'C_Tax_ID', type: 'string' },
  { key: 'taxableAmount', column: 'Taxbaseamt', type: 'amount' },
  { key: 'taxAmount', column: 'Taxamt', type: 'amount' },
];
// @sf-generated-end columns:lineTax

const filters = [];

// @sf-generated-start component:LineTaxTable
export default function LineTaxTable(props) {
  // @sf-custom-slot hooks:LineTaxTable
  return <DataTable columns={columns} filters={filters} {...props} />;
}
// @sf-generated-end component:LineTaxTable

// @sf-custom-slot section:LineTaxTable-custom

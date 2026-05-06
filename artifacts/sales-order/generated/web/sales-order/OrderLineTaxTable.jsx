import { DataTable } from '@/components/contract-ui';

// @sf-generated-start columns:orderLineTax
const columns = [
  { key: 'lineNo', column: 'Line', type: 'number' },
  { key: 'tax', column: 'C_Tax_ID', type: 'string' },
  { key: 'taxableAmount', column: 'Taxbaseamt', type: 'amount' },
  { key: 'taxAmount', column: 'Taxamt', type: 'amount' },
];
// @sf-generated-end columns:orderLineTax

const filters = [];

// @sf-generated-start component:OrderLineTaxTable
export default function OrderLineTaxTable(props) {
  // @sf-custom-slot hooks:OrderLineTaxTable
  return <DataTable columns={columns} filters={filters} {...props} />;
}
// @sf-generated-end component:OrderLineTaxTable

// @sf-custom-slot section:OrderLineTaxTable-custom

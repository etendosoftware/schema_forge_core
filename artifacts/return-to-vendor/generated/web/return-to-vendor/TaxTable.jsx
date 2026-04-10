import { DataTable } from '@/components/contract-ui';

// @sf-generated-start columns:tax
const columns = [

];
// @sf-generated-end columns:tax

const filters = [];

// @sf-generated-start component:TaxTable
export default function TaxTable(props) {
  return <DataTable columns={columns} filters={filters} {...props} />;
}
// @sf-generated-end component:TaxTable

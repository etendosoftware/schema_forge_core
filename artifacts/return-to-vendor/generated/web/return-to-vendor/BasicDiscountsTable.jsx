import { DataTable } from '@/components/contract-ui';

// @sf-generated-start columns:basicDiscounts
const columns = [

];
// @sf-generated-end columns:basicDiscounts

const filters = [];

// @sf-generated-start component:BasicDiscountsTable
export default function BasicDiscountsTable(props) {
  return <DataTable columns={columns} filters={filters} {...props} />;
}
// @sf-generated-end component:BasicDiscountsTable

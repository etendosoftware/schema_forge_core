import { DataTable } from '@/components/contract-ui';

// @sf-generated-start columns:productPrice
const columns = [

];
// @sf-generated-end columns:productPrice

const filters = [];

// @sf-generated-start component:ProductPriceTable
export default function ProductPriceTable(props) {
  return <DataTable columns={columns} filters={filters} {...props} />;
}
// @sf-generated-end component:ProductPriceTable

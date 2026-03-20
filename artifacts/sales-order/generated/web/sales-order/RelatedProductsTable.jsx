import { DataTable } from '@/components/contract-ui';

// @sf-generated-start columns:relatedProducts
const columns = [
  { key: 'lineNo', column: 'Line', type: 'number' },
  { key: 'product', column: 'M_Product_ID', type: 'string' },
];
// @sf-generated-end columns:relatedProducts

const filters = [];

// @sf-generated-start component:RelatedProductsTable
export default function RelatedProductsTable(props) {
  // @sf-custom-slot hooks:RelatedProductsTable
  return <DataTable columns={columns} filters={filters} {...props} />;
}
// @sf-generated-end component:RelatedProductsTable

// @sf-custom-slot section:RelatedProductsTable-custom

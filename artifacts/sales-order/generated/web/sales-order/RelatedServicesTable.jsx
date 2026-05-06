import { DataTable } from '@/components/contract-ui';

// @sf-generated-start columns:relatedServices
const columns = [
  { key: 'documentNo', column: 'documentNo', type: 'string' },
  { key: 'lineNo', column: 'lineNo', type: 'number' },
  { key: 'product', column: 'product', type: 'string' },
  { key: 'amount', column: 'amount', type: 'amount' },
  { key: 'quantity', column: 'quantity', type: 'string' },
];
// @sf-generated-end columns:relatedServices

const filters = [];

// @sf-generated-start component:RelatedServicesTable
export default function RelatedServicesTable(props) {
  // @sf-custom-slot hooks:RelatedServicesTable
  return <DataTable columns={columns} filters={filters} {...props} />;
}
// @sf-generated-end component:RelatedServicesTable

// @sf-custom-slot section:RelatedServicesTable-custom

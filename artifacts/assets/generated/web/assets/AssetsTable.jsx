import { DataTable } from '@/components/contract-ui';

// @sf-generated-start columns:assets
const columns = [
  { key: 'searchKey', column: 'Value', type: 'string' },
  { key: 'name', column: 'Name', type: 'string' },
  { key: 'assetCategory', column: 'A_Asset_Group_ID', type: 'string' },
  { key: 'documentNo', column: 'DocumentNo', type: 'string' },
  { key: 'currency', column: 'C_Currency_ID', type: 'string' },
  { key: 'depreciate', column: 'IsDepreciated', type: 'boolean' },
  { key: 'depreciationType', column: 'Amortizationtype', type: 'string' },
  { key: 'calculateType', column: 'Amortizationcalctype', type: 'string' },
  { key: 'fullyDepreciated', column: 'IsFullyDepreciated', type: 'boolean', badge: true },
];
// @sf-generated-end columns:assets

const filters = ['searchKey', 'name', 'assetCategory', 'depreciate', 'fullyDepreciated'];

// @sf-generated-start component:AssetsTable
export default function AssetsTable(props) {
  // @sf-custom-slot hooks:AssetsTable
  return <DataTable columns={columns} filters={filters} {...props} />;
}
// @sf-generated-end component:AssetsTable

// @sf-custom-slot section:AssetsTable-custom

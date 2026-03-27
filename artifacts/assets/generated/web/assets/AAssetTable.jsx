import { DataTable } from '@/components/contract-ui';

// @sf-generated-start columns:aAsset
const columns = [
  { key: 'searchKey', column: 'Value', type: 'string' },
  { key: 'name', column: 'Name', type: 'string' },
  { key: 'assetCategory', column: 'A_Asset_Group_ID', type: 'string' },
  { key: 'documentNo', column: 'DocumentNo', type: 'string' },
  { key: 'depreciate', column: 'IsDepreciated', type: 'boolean' },
  { key: 'depreciationType', column: 'Amortizationtype', type: 'string' },
  { key: 'calculateType', column: 'Amortizationcalctype', type: 'string' },
  { key: 'fullyDepreciated', column: 'IsFullyDepreciated', type: 'boolean' },
];
// @sf-generated-end columns:aAsset

const filters = ['searchKey', 'name', 'assetCategory', 'depreciate', 'fullyDepreciated'];

// @sf-generated-start component:AAssetTable
export default function AAssetTable(props) {
  // @sf-custom-slot hooks:AAssetTable
  return <DataTable columns={columns} filters={filters} {...props} />;
}
// @sf-generated-end component:AAssetTable

// @sf-custom-slot section:AAssetTable-custom

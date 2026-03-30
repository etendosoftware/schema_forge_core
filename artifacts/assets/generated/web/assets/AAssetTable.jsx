import { DataTable } from '@/components/contract-ui';

// @sf-generated-start columns:aAsset
const columns = [
  { key: 'name', column: 'Name', type: 'string', label: 'Name' },
  { key: 'assetCategory', column: 'A_Asset_Group_ID', type: 'string', label: 'Asset Category' },
  { key: 'calculateType', column: 'Amortizationcalctype', type: 'enum', label: 'Calculate Type', enumLabels: { 'PE': 'Percentage', 'TI': 'Time' } },
  { key: 'purchaseDate', column: 'Datepurchased', type: 'date', label: 'Purchase Date' },
  { key: 'depreciationStartDate', column: 'Amortizationstartdate', type: 'date', label: 'Depreciation Start Date' },
  { key: 'assetValue', column: 'AssetValueAmt', type: 'amount', label: 'Asset Value', summable: true },
  { key: 'depreciatedValue', column: 'Depreciatedvalue', type: 'amount', label: 'Depreciated Value', summable: true },
  { key: 'fullyDepreciated', column: 'IsFullyDepreciated', type: 'boolean', label: 'Fully Depreciated', badge: true },
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

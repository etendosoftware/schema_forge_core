import { DataTable } from '@/components/contract-ui';

// @sf-generated-start columns:assets
const columns = [
  { key: 'name', column: 'Name', type: 'string' },
  { key: 'assetCategory', column: 'A_Asset_Group_ID', type: 'string' },
  { key: 'calculateType', column: 'Amortizationcalctype', type: 'string' },
  { key: 'purchaseDate', column: 'Datepurchased', type: 'date' },
  { key: 'depreciationStartDate', column: 'Amortizationstartdate', type: 'date' },
  { key: 'assetValue', column: 'AssetValueAmt', type: 'amount', summable: true },
  { key: 'depreciatedValue', column: 'Depreciatedvalue', type: 'amount', summable: true },
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

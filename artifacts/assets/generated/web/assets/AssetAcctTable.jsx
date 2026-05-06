import { DataTable } from '@/components/contract-ui';

// @sf-generated-start columns:assetAcct
const columns = [
  { key: 'accountingSchema', column: 'C_AcctSchema_ID', type: 'selector', label: 'General Ledger' },
  { key: 'accumulatedDepreciation', column: 'A_Accumdepreciation_Acct', type: 'selector', label: 'Accumulated Depreciation' },
  { key: 'depreciation', column: 'A_Depreciation_Acct', type: 'selector', label: 'Depreciation' },
];
// @sf-generated-end columns:assetAcct

const filters = [];

// @sf-generated-start component:AssetAcctTable
export default function AssetAcctTable(props) {
  return <DataTable columns={columns} filters={filters} {...props} />;
}
// @sf-generated-end component:AssetAcctTable

import { DataTable } from '@/components/contract-ui';

const columns = [
  { key: 'accountingSchema', column: 'C_AcctSchema_ID', type: 'string', label: 'General Ledger' },
  { key: 'accumulatedDepreciation', column: 'A_Accumdepreciation_Acct', type: 'string', label: 'Accumulated Depreciation' },
  { key: 'depreciation', column: 'A_Depreciation_Acct', type: 'string', label: 'Depreciation' },
];

export default function AssetAcctTable(props) {
  return <DataTable columns={columns} filters={[]} {...props} />;
}

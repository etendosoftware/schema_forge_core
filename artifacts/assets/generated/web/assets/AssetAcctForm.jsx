import { EntityForm } from '@/components/contract-ui';

const fields = [
  { key: 'accountingSchema', column: 'C_AcctSchema_ID', type: 'selector', required: true, section: 'principal', reference: 'AcctSchema', inputMode: 'selector' },
  { key: 'accumulatedDepreciation', column: 'A_Accumdepreciation_Acct', type: 'selector', section: 'principal', reference: 'ValidCombination', inputMode: 'selector' },
  { key: 'depreciation', column: 'A_Depreciation_Acct', type: 'selector', section: 'principal', reference: 'ValidCombination', inputMode: 'selector' },
];

export default function AssetAcctForm(props) {
  return <EntityForm fields={fields} {...props} />;
}

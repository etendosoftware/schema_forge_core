import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:lines
const fields = [
  { key: 'asset', column: 'A_Asset_ID', type: 'selector', label: 'Asset', section: 'principal', reference: 'Asset', inputMode: 'selector', readOnlyLogic: (record) => record['posted'] === 'Y' },
  { key: 'amortizationPercentage', column: 'Amortization_Percentage', type: 'number', label: 'Amortization Percentage', section: 'principal', readOnlyLogic: (record) => record['processed'] === 'Y' },
  { key: 'amortizationAmount', column: 'Amortizationamt', type: 'number', label: 'Amortization Amount', required: true, section: 'principal', readOnlyLogic: (record) => record['processed'] === 'Y' },
];
// @sf-generated-end fields:lines

// @sf-generated-start component:LinesForm
export default function LinesForm(props) {
  return <EntityForm fields={fields} {...props} />;
}

// @sf-generated-end component:LinesForm

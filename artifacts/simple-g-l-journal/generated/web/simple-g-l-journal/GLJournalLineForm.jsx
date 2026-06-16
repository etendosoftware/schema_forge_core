import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:gLJournalLine
const fields = [
  { key: 'gLItems', column: 'Account_ID', type: 'search', label: 'GL Item', lookup: true, section: 'principal', reference: 'Glitem', inputMode: 'search', readOnlyLogic: (record) => record['processed'] === true || record['multigeneralLedger'] !== true },
  { key: 'accountingCombination', column: 'C_ValidCombination_ID', type: 'selector', label: 'Account', lookup: true, section: 'principal', reference: 'ValidCombination', inputMode: 'selector', readOnlyLogic: (record) => record['processed'] === true || record['multigeneralLedger'] === true },
  { key: 'description', column: 'Description', type: 'textarea', label: 'Description', section: 'other', defaultValue: '@DESCRIPTION1@', readOnlyLogic: (record) => record['processed'] === true },
  { key: 'foreignCurrencyDebit', column: 'AmtSourceDr', type: 'number', label: 'Debit', required: true, section: 'principal', readOnlyLogic: (record) => record['processed'] === true },
  { key: 'foreignCurrencyCredit', column: 'AmtSourceCr', type: 'number', label: 'Credit', required: true, section: 'principal', readOnlyLogic: (record) => record['processed'] === true },
  { key: 'businessPartner', column: 'C_Bpartner_ID', type: 'search', label: 'Business Partner', section: 'other', reference: 'BPartner', inputMode: 'search', visible: null, visibilitySource: 'server', displayLogicReason: 'server-macro', readOnlySource: 'server', readOnlyLogicReason: 'untranslatable-token' },
  { key: 'product', column: 'M_Product_ID', type: 'selector', label: 'Product', section: 'other', reference: 'Product', inputMode: 'selector', visible: null, visibilitySource: 'server', displayLogicReason: 'server-macro', readOnlyLogic: (record) => record['posted'] === 'Y' },
  { key: 'project', column: 'C_Project_ID', type: 'search', label: 'Project', section: 'other', reference: 'Project', inputMode: 'search', visible: null, visibilitySource: 'server', displayLogicReason: 'server-macro', readOnlyLogic: (record) => record['posted'] === 'Y' },
  { key: 'activity', column: 'C_Activity_ID', type: 'selector', label: 'Activity', section: 'other', reference: 'Activity', inputMode: 'selector', visible: null, visibilitySource: 'server', displayLogicReason: 'accounting-dimension', readOnlyLogic: (record) => record['posted'] === 'Y' },
  { key: 'salesCampaign', column: 'C_Campaign_ID', type: 'selector', label: 'Sales Campaign', section: 'other', reference: 'Campaign', inputMode: 'selector', visible: null, visibilitySource: 'server', displayLogicReason: 'accounting-dimension', readOnlyLogic: (record) => record['posted'] === 'Y' },
  { key: 'salesRegion', column: 'C_Salesregion_ID', type: 'selector', label: 'Sales Region', section: 'other', reference: 'Salesregion', inputMode: 'selector', visible: null, visibilitySource: 'server', displayLogicReason: 'accounting-dimension', readOnlyLogic: (record) => record['processed'] === true },
  { key: 'stDimension', column: 'User1_ID', type: 'selector', label: '1st Dimension', section: 'other', reference: 'User1', inputMode: 'selector', visible: null, visibilitySource: 'server', displayLogicReason: 'server-macro', readOnlyLogic: (record) => record['posted'] === 'Y' },
  { key: 'ndDimension', column: 'User2_ID', type: 'selector', label: '2nd Dimension', section: 'other', reference: 'User2', inputMode: 'selector', visible: null, visibilitySource: 'server', displayLogicReason: 'server-macro', readOnlyLogic: (record) => record['posted'] === 'Y' },
  { key: 'asset', column: 'A_Asset_ID', type: 'selector', label: 'Asset', section: 'other', reference: 'Asset', inputMode: 'selector', visible: null, visibilitySource: 'server', displayLogicReason: 'accounting-dimension', readOnlyLogic: (record) => record['posted'] === 'Y' },
  { key: 'costCenter', column: 'C_Costcenter_ID', type: 'selector', label: 'Cost Center', section: 'other', reference: 'Costcenter', inputMode: 'selector', visible: null, visibilitySource: 'server', displayLogicReason: 'server-macro', readOnlyLogic: (record) => record['posted'] === 'Y' },
];
// @sf-generated-end fields:gLJournalLine

// @sf-generated-start component:GLJournalLineForm
export default function GLJournalLineForm(props) {
  return <EntityForm fields={fields} {...props} />;
}

// @sf-generated-end component:GLJournalLineForm

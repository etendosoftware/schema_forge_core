import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:assets
const fields = [
  { key: 'businessPartner', column: 'C_BPartner_ID', type: 'search', label: 'Business Partner', section: 'principal', reference: 'BPartner', inputMode: 'search' },
  { key: 'eTADASActivity', column: 'EM_Etadas_C_Activity_ID', type: 'selector', label: 'Activity', section: 'principal', reference: 'Activity', inputMode: 'selector', visible: null, visibilitySource: 'server', displayLogicReason: 'accounting-dimension' },
  { key: 'eTADASCostCenter', column: 'EM_Etadas_Costcenter_ID', type: 'selector', label: 'Cost Center', section: 'principal', reference: 'Costcenter', inputMode: 'selector', visible: null, visibilitySource: 'server', displayLogicReason: 'accounting-dimension' },
  { key: 'eTADASSalesCampaign', column: 'EM_Etadas_Campaign_ID', type: 'selector', label: 'Sales Campaign', section: 'principal', reference: 'Campaign', inputMode: 'selector', visible: null, visibilitySource: 'server', displayLogicReason: 'accounting-dimension' },
  { key: 'eTADASSalesRegion', column: 'EM_Etadas_Salesregion_ID', type: 'selector', label: 'Sales Region', section: 'other', reference: 'SalesRegion', inputMode: 'selector', visible: null, visibilitySource: 'server', displayLogicReason: 'accounting-dimension' },
  { key: 'eTADASUser1', column: 'EM_Etadas_User1_ID', type: 'selector', label: '1st Dimension', section: 'other', reference: 'User1', inputMode: 'selector', visible: null, visibilitySource: 'server', displayLogicReason: 'accounting-dimension' },
  { key: 'eTADASUser2', column: 'EM_Etadas_User2_ID', type: 'selector', label: '2nd Dimension', section: 'other', reference: 'User2', inputMode: 'selector', visible: null, visibilitySource: 'server', displayLogicReason: 'accounting-dimension' },
];
// @sf-generated-end fields:assets

// @sf-generated-start component:AssetsForm
export default function AssetsForm(props) {
  return <EntityForm fields={fields} {...props} />;
}

// @sf-generated-end component:AssetsForm

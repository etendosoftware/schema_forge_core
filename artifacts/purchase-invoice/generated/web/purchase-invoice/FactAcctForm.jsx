import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:factAcct
const fields = [
  { key: 'cAcctSchemaId', column: 'C_AcctSchema_ID', type: 'selector', required: true, readOnly: true, section: 'other', reference: 'AcctSchema', inputMode: 'selector' },
  { key: 'cCurrencyId', column: 'C_Currency_ID', type: 'selector', required: true, readOnly: true, section: 'other', reference: 'Currency', inputMode: 'selector' },
  { key: 'cPeriodId', column: 'C_Period_ID', type: 'selector', required: true, readOnly: true, section: 'other', reference: 'Period', inputMode: 'selector' },
  { key: 'dateAcct', column: 'DateAcct', type: 'date', required: true, readOnly: true, section: 'other' },
  { key: 'accountId', column: 'Account_ID', type: 'search', required: true, readOnly: true, section: 'other', reference: 'ElementValue', inputMode: 'search' },
  { key: 'amtAcctDr', column: 'AmtAcctDr', type: 'number', required: true, readOnly: true, section: 'other' },
  { key: 'amtAcctCr', column: 'AmtAcctCr', type: 'number', required: true, readOnly: true, section: 'other' },
  { key: 'description', column: 'Description', type: 'textarea', section: 'principal' },
  { key: 'cBpartnerId', column: 'C_BPartner_ID', type: 'search', readOnly: true, section: 'other', reference: 'BPartner', inputMode: 'search' },
  { key: 'mProductId', column: 'M_Product_ID', type: 'search', readOnly: true, section: 'other', reference: 'Product', inputMode: 'search' },
  { key: 'cProjectId', column: 'C_Project_ID', type: 'selector', readOnly: true, section: 'other', reference: 'Project', inputMode: 'selector' },
  { key: 'cCostcenterId', column: 'C_Costcenter_ID', type: 'selector', readOnly: true, section: 'other', reference: 'Costcenter', inputMode: 'selector' },
  { key: 'aAssetId', column: 'A_Asset_ID', type: 'selector', readOnly: true, section: 'other', reference: 'Asset', inputMode: 'selector' },
  { key: 'user1Id', column: 'User1_ID', type: 'selector', readOnly: true, section: 'other', reference: 'User1', inputMode: 'selector' },
  { key: 'user2Id', column: 'User2_ID', type: 'selector', readOnly: true, section: 'other', reference: 'User2', inputMode: 'selector' },
];
// @sf-generated-end fields:factAcct

// @sf-generated-start component:FactAcctForm
export default function FactAcctForm(props) {
  // @sf-custom-slot hooks:FactAcctForm
  return <EntityForm fields={fields} {...props} />;
}
// @sf-generated-end component:FactAcctForm

// @sf-custom-slot section:FactAcctForm-custom

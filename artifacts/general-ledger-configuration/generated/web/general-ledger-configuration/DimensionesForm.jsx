import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:Dimensiones
const fields = [
  { key: 'sequenceNumber', column: 'SeqNo', type: 'number', label: 'Sequence Number', required: true, readOnly: true, section: 'other', defaultValue: '@SQL=SELECT COALESCE(MAX(SeqNo),0)+10 AS DefaultValue FROM C_AcctSchema_Element WHERE C_AcctSchema_ID=@C_AcctSchema_ID@' },
  { key: 'name', column: 'Name', type: 'text', label: 'Name', required: true, readOnly: true, section: 'other' },
  { key: 'type', column: 'ElementType', type: 'select', label: 'Type', required: true, readOnly: true, section: 'other', options: [{ value: 'AC', label: 'Account' }, { value: 'AY', label: 'Activity' }, { value: 'AS', label: 'Asset' }, { value: 'BP', label: 'Bus.Partner' }, { value: 'MC', label: 'Campaign' }, { value: 'CC', label: 'Cost Center' }, { value: 'LF', label: 'Location From' }, { value: 'LT', label: 'Location To' }, { value: 'OO', label: 'Organization' }, { value: 'PR', label: 'Product' }, { value: 'PJ', label: 'Project' }, { value: 'SR', label: 'Sales Region' }, { value: 'OT', label: 'Trx. Org' }, { value: 'U1', label: 'User 1' }, { value: 'U2', label: 'User 2' }] },
  { key: 'trxOrganization', column: 'Org_ID', type: 'search', label: 'Trx Organization', section: 'principal', reference: 'Org', inputMode: 'search' },
  { key: 'active', column: 'IsActive', type: 'checkbox', label: 'Active', required: true, section: 'principal' },
  { key: 'accountingElement', column: 'C_Element_ID', type: 'selector', label: 'Account Tree', section: 'principal', reference: 'Element', inputMode: 'selector', readOnlyLogic: (record) => record['type'] !== 'AC' },
  { key: 'balanced', column: 'IsBalanced', type: 'checkbox', label: 'Balanced', required: true, section: 'principal' },
  { key: 'mandatory', column: 'IsMandatory', type: 'checkbox', label: 'Mandatory', required: true, section: 'other' },
  { key: 'accountElement', column: 'C_ElementValue_ID', type: 'selector', label: 'Account Element', section: 'other', reference: 'ElementValue', inputMode: 'selector', readOnlyLogic: (record) => record['type'] !== 'AC' },
  { key: 'product', column: 'M_Product_ID', type: 'search', label: 'Product', section: 'other', reference: 'Product', inputMode: 'search' },
  { key: 'businessPartner', column: 'C_BPartner_ID', type: 'search', label: 'Business Partner', section: 'other', reference: 'BPartner', inputMode: 'search' },
  { key: 'locationAddress', column: 'C_Location_ID', type: 'search', label: 'Location / Address', section: 'other', reference: 'Location', inputMode: 'search' },
  { key: 'salesRegion', column: 'C_SalesRegion_ID', type: 'selector', label: 'Sales Region', section: 'other', reference: 'SalesRegion', inputMode: 'selector' },
  { key: 'project', column: 'C_Project_ID', type: 'selector', label: 'Project', section: 'other', reference: 'Project', inputMode: 'selector' },
  { key: 'salesCampaign', column: 'C_Campaign_ID', type: 'selector', label: 'Sales Campaign', section: 'other', reference: 'Campaign', inputMode: 'selector' },
  { key: 'activity', column: 'C_Activity_ID', type: 'selector', label: 'Activity', section: 'other', reference: 'Activity', inputMode: 'selector' },
];
// @sf-generated-end fields:Dimensiones

// @sf-generated-start component:DimensionesForm
export default function DimensionesForm(props) {
  return <EntityForm fields={fields} {...props} />;
}

// @sf-generated-end component:DimensionesForm

import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:assets
const fields = [
  { key: 'searchKey', column: 'Value', type: 'text', required: true, section: 'principal' },
  { key: 'name', column: 'Name', type: 'text', required: true, section: 'principal' },
  // @sf-custom-slot callout:SL_Depreciate
  { key: 'assetCategory', column: 'A_Asset_Group_ID', type: 'selector', required: true, section: 'principal', reference: 'AssetGroup', inputMode: 'selector' },
  { key: 'documentNo', column: 'DocumentNo', type: 'text', readOnly: true, section: 'other' },
  { key: 'description', column: 'Description', type: 'textarea', section: 'principal' },
  { key: 'currency', column: 'C_Currency_ID', type: 'selector', section: 'other', reference: 'Currency', inputMode: 'selector', defaultValue: '@C_Currency_ID@' },
  // @sf-custom-slot callout:SL_Asset_Product
  { key: 'product', column: 'M_Product_ID', type: 'search', section: 'other', reference: 'Product', inputMode: 'search' },
  { key: 'depreciate', column: 'IsDepreciated', type: 'checkbox', required: true, section: 'other' },
  { key: 'depreciationType', column: 'Amortizationtype', type: 'select', required: true, section: 'other', options: [{ value: 'LI', label: 'Linear' }], displayLogic: (d) => d.depreciate === true || d.depreciate === 'Y' },
  { key: 'calculateType', column: 'Amortizationcalctype', type: 'select', required: true, section: 'other', options: [{ value: 'PE', label: 'Percentage' }, { value: 'TI', label: 'Time' }], displayLogic: (d) => d.depreciate === true || d.depreciate === 'Y' },
  { key: 'annualDepreciation', column: 'Annualamortizationpercentage', type: 'number', section: 'other', displayLogic: (d) => d.depreciate === true || d.depreciate === 'Y' },
  { key: 'amortize', column: 'Assetschedule', type: 'select', required: true, section: 'other', options: [{ value: 'MO', label: 'Monthly' }, { value: 'YE', label: 'Yearly' }], displayLogic: (d) => d.depreciate === true || d.depreciate === 'Y' },
  { key: 'usableLifeYears', column: 'UseLifeYears', type: 'number', section: 'other', displayLogic: (d) => d.depreciate === true || d.depreciate === 'Y' },
  { key: 'usableLifeMonths', column: 'UseLifeMonths', type: 'number', section: 'other', displayLogic: (d) => d.depreciate === true || d.depreciate === 'Y' },
  { key: 'purchaseDate', column: 'Datepurchased', type: 'date', section: 'other', displayLogic: (d) => d.depreciate === true || d.depreciate === 'Y' },
  { key: 'cancellationDate', column: 'Datecancelled', type: 'date', section: 'other', displayLogic: (d) => d.depreciate === true || d.depreciate === 'Y' },
  { key: 'depreciationStartDate', column: 'Amortizationstartdate', type: 'date', section: 'other', displayLogic: (d) => d.depreciate === true || d.depreciate === 'Y' },
  { key: 'depreciationEndDate', column: 'Amortizationenddate', type: 'date', section: 'other', displayLogic: (d) => d.depreciate === true || d.depreciate === 'Y' },
  // @sf-custom-slot callout:SL_Assets
  { key: 'assetValue', column: 'AssetValueAmt', type: 'number', section: 'other', displayLogic: (d) => d.depreciate === true || d.depreciate === 'Y' },
  // @sf-custom-slot callout:SL_Assets
  { key: 'residualAssetValue', column: 'Residualassetvalueamt', type: 'number', section: 'other', displayLogic: (d) => d.depreciate === true || d.depreciate === 'Y' },
  // @sf-custom-slot callout:SL_Assets
  { key: 'depreciationAmt', column: 'Amortizationvalueamt', type: 'number', section: 'other', displayLogic: (d) => d.depreciate === true || d.depreciate === 'Y' },
  { key: 'previouslyDepreciatedAmt', column: 'Depreciatedpreviousamt', type: 'number', section: 'other', defaultValue: '0', displayLogic: (d) => d.depreciate === true || d.depreciate === 'Y' },
  { key: 'processed', column: 'Processed', type: 'text', required: true, section: 'other', defaultValue: 'N' },
  { key: 'depreciatedValue', column: 'Depreciatedvalue', type: 'number', readOnly: true, section: 'other', defaultValue: '0', displayLogic: (d) => d.depreciate === true || d.depreciate === 'Y' },
  { key: 'depreciatedPlan', column: 'Depreciatedplan', type: 'number', readOnly: true, section: 'other', defaultValue: '0', displayLogic: (d) => d.depreciate === true || d.depreciate === 'Y' },
  { key: 'fullyDepreciated', column: 'IsFullyDepreciated', type: 'checkbox', required: true, readOnly: true, section: 'other', defaultValue: 'N', displayLogic: (d) => d.depreciate === true || d.depreciate === 'Y' },
  { key: 'project', column: 'C_Project_ID', type: 'search', section: 'other', reference: 'Project', inputMode: 'search', displayLogic: (d) => d.depreciate === true || d.depreciate === 'Y' },
  { key: 'processAsset', column: 'Process_Asset', type: 'text', required: true, section: 'other', defaultValue: 'N' },
];
// @sf-generated-end fields:assets

// @sf-generated-start component:AssetsForm
export default function AssetsForm(props) {
  // @sf-custom-slot hooks:AssetsForm
  return <EntityForm fields={fields} {...props} />;
}
// @sf-generated-end component:AssetsForm

// @sf-custom-slot section:AssetsForm-custom

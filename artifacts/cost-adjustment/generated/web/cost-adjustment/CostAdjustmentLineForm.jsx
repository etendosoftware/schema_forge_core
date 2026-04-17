import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:costAdjustmentLine
const fields = [
  { key: 'product', column: 'M_Product_ID', type: 'search', required: true, section: 'principal', reference: 'Product', inputMode: 'search' },
  { key: 'inventoryTransaction', column: 'M_Transaction_ID', type: 'search', section: 'principal', reference: 'MaterialTransaction', inputMode: 'search' },
  { key: 'adjustmentAmount', column: 'AdjustmentAmount', type: 'number', required: true, section: 'principal' },
  { key: 'lineNo', column: 'Line', type: 'number', required: true, section: 'principal' },
  { key: 'description', column: 'Description', type: 'textarea', section: 'other' },
  { key: 'isActive', column: 'IsActive', type: 'checkbox', required: true, section: 'other' },
  { key: 'isSource', column: 'IsSource', type: 'checkbox', required: true, readOnly: true, section: 'other' },
  { key: 'isRelated', column: 'IsRelated', type: 'checkbox', required: true, readOnly: true, section: 'other' },
  { key: 'currency', column: 'C_Currency_ID', type: 'selector', readOnly: true, section: 'other', reference: 'Currency', inputMode: 'selector' },
];
// @sf-generated-end fields:costAdjustmentLine

// @sf-generated-start component:CostAdjustmentLineForm
export default function CostAdjustmentLineForm(props) {
  // @sf-custom-slot hooks:CostAdjustmentLineForm
  return <EntityForm fields={fields} {...props} />;
}
// @sf-generated-end component:CostAdjustmentLineForm

// @sf-custom-slot section:CostAdjustmentLineForm-custom

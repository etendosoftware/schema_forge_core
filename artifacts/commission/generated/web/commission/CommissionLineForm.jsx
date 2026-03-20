import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:commissionLine
const fields = [
  { key: 'lineNo', column: 'Line', type: 'number', required: true, section: 'principal' },
  { key: 'product', column: 'M_Product_ID', type: 'search', section: 'principal', reference: 'Product', inputMode: 'search' },
  { key: 'productCategory', column: 'M_Product_Category_ID', type: 'selector', section: 'principal', reference: 'ProductCategory', inputMode: 'selector' },
  { key: 'bpGroup', column: 'C_BP_Group_ID', type: 'selector', section: 'principal', reference: 'BusinessPartnerGroup', inputMode: 'selector' },
  { key: 'commissionPercentage', column: 'CommissionPercentage', type: 'number', section: 'other' },
  { key: 'commissionAmount', column: 'CommissionAmt', type: 'number', section: 'other' },
  { key: 'quantityMultiplier', column: 'QtyMultiplier', type: 'number', section: 'other' },
  { key: 'isActive', column: 'IsActive', type: 'checkbox', required: true, section: 'other' },
];
// @sf-generated-end fields:commissionLine

// @sf-generated-start component:CommissionLineForm
export default function CommissionLineForm(props) {
  // @sf-custom-slot hooks:CommissionLineForm
  return <EntityForm fields={fields} {...props} />;
}
// @sf-generated-end component:CommissionLineForm

// @sf-custom-slot section:CommissionLineForm-custom

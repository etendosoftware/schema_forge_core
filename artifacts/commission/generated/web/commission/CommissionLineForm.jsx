import { EntityForm } from '@/components/contract-ui';

const fields = [
  { key: 'lineNo', column: 'Line', type: 'number', required: true },
  { key: 'product', column: 'M_Product_ID', type: 'search', reference: 'Product', inputMode: 'search' },
  { key: 'productCategory', column: 'M_Product_Category_ID', type: 'selector', reference: 'ProductCategory', inputMode: 'selector' },
  { key: 'bpGroup', column: 'C_BP_Group_ID', type: 'selector', reference: 'BusinessPartnerGroup', inputMode: 'selector' },
  { key: 'commissionPercentage', column: 'CommissionPercentage', type: 'number' },
  { key: 'commissionAmount', column: 'CommissionAmt', type: 'number' },
  { key: 'quantityMultiplier', column: 'QtyMultiplier', type: 'number' },
  { key: 'isActive', column: 'IsActive', type: 'checkbox', required: true },
];

export default function CommissionLineForm(props) {
  return <EntityForm fields={fields} {...props} />;
}

import { EntityForm } from '@/components/contract-ui';

const fields = [
  { key: 'lineNo', label: 'Line No', type: 'number', required: true },
  { key: 'product', label: 'Product', type: 'search', reference: 'Product', inputMode: 'search' },
  { key: 'productCategory', label: 'Product Category', type: 'selector', reference: 'ProductCategory', inputMode: 'selector' },
  { key: 'bpGroup', label: 'Bp Group', type: 'selector', reference: 'BusinessPartnerGroup', inputMode: 'selector' },
  { key: 'commissionPercentage', label: 'Commission Percentage', type: 'number' },
  { key: 'commissionAmount', label: 'Commission Amount', type: 'number' },
  { key: 'quantityMultiplier', label: 'Quantity Multiplier', type: 'number' },
  { key: 'isActive', label: 'Is Active', type: 'checkbox', required: true },
];

export default function CommissionLineForm(props) {
  return <EntityForm fields={fields} {...props} />;
}

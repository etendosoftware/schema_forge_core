import { EntityForm } from '@/components/contract-ui';

const fields = [
  { key: 'product', column: 'M_Product_ID', type: 'search', required: true, reference: 'Product', inputMode: 'search' },
  { key: 'listPrice', column: 'PriceList', type: 'number', required: true },
  { key: 'standardPrice', column: 'PriceStd', type: 'number', required: true },
  { key: 'limitPrice', column: 'PriceLimit', type: 'number' },
  { key: 'uom', column: 'C_UOM_ID', type: 'selector', readOnly: true, reference: 'UOM', inputMode: 'selector' },
];

export default function PriceListLineForm(props) {
  return <EntityForm fields={fields} {...props} />;
}

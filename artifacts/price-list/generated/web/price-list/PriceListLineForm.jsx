import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:priceListLine
const fields = [
  { key: 'product', column: 'M_Product_ID', type: 'search', required: true, section: 'principal', reference: 'Product', inputMode: 'search' },
  { key: 'listPrice', column: 'PriceList', type: 'number', required: true, section: 'principal' },
  { key: 'standardPrice', column: 'PriceStd', type: 'number', required: true, section: 'principal' },
  { key: 'limitPrice', column: 'PriceLimit', type: 'number', section: 'principal' },
  { key: 'uom', column: 'C_UOM_ID', type: 'selector', readOnly: true, section: 'other', reference: 'UOM', inputMode: 'selector' },
];
// @sf-generated-end fields:priceListLine

// @sf-generated-start component:PriceListLineForm
export default function PriceListLineForm(props) {
  return <EntityForm fields={fields} {...props} />;
}
PriceListLineForm.hasCollapsedFields = false;
// @sf-generated-end component:PriceListLineForm

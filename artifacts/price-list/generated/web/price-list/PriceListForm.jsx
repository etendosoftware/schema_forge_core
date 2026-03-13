import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:priceList
const fields = [
  { key: 'name', column: 'Name', type: 'text', required: true, section: 'principal' },
  { key: 'description', column: 'Description', type: 'textarea', section: 'principal' },
  { key: 'currency', column: 'C_Currency_ID', type: 'text', required: true, section: 'principal' },
  { key: 'isDefault', column: 'IsDefault', type: 'checkbox', section: 'principal' },
  { key: 'isSalesPrice', column: 'IsSOPriceList', type: 'checkbox', readOnly: true, section: 'other' },
  { key: 'isActive', column: 'IsActive', type: 'checkbox', required: true, readOnly: true, section: 'other' },
];
// @sf-generated-end fields:priceList

// @sf-generated-start component:PriceListForm
export default function PriceListForm(props) {
  // @sf-custom-slot hooks:PriceListForm
  return <EntityForm fields={fields} {...props} />;
}
// @sf-generated-end component:PriceListForm

// @sf-custom-slot section:PriceListForm-custom

import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:basicDiscounts
const fields = [
  { key: 'lineNo', column: 'Line', type: 'number', required: true, readOnly: true },
  { key: 'discount', column: 'C_Discount_ID', type: 'search', required: true, readOnly: true, reference: 'Discount' },
  { key: 'cascade', column: 'Cascade', type: 'checkbox', required: true, readOnly: true },
  { key: 'active', column: 'Isactive', type: 'checkbox', required: true, readOnly: true },
];
// @sf-generated-end fields:basicDiscounts

// @sf-generated-start component:BasicDiscountsForm
export default function BasicDiscountsForm(props) {
  // @sf-custom-slot hooks:BasicDiscountsForm
  return <EntityForm fields={fields} {...props} />;
}
// @sf-generated-end component:BasicDiscountsForm

// @sf-custom-slot section:BasicDiscountsForm-custom

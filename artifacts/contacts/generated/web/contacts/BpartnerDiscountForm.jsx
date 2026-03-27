import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:bpartnerDiscount
const fields = [
  { key: 'lineNo', column: 'Line', type: 'number', required: true, section: 'principal', defaultValue: '@SQL=SELECT COALESCE(MAX(LINE),0)+10 AS DefaultValue FROM C_BPARTNER_DISCOUNT WHERE C_BPARTNER_ID=@C_BPARTNER_ID@' },
  { key: 'discount', column: 'C_Discount_ID', type: 'selector', required: true, section: 'principal', reference: 'Discount', inputMode: 'selector' },
  { key: 'customer', column: 'IsCustomer', type: 'checkbox', required: true, section: 'principal', defaultValue: 'Y' },
  { key: 'vendor', column: 'IsVendor', type: 'checkbox', required: true, section: 'principal', defaultValue: 'N' },
  { key: 'applyInOrder', column: 'Applyinorder', type: 'checkbox', required: true, section: 'principal', defaultValue: 'N' },
  { key: 'cascade', column: 'Cascade', type: 'checkbox', required: true, section: 'principal', defaultValue: 'N' },
];
// @sf-generated-end fields:bpartnerDiscount

// @sf-generated-start component:BpartnerDiscountForm
export default function BpartnerDiscountForm(props) {
  // @sf-custom-slot hooks:BpartnerDiscountForm
  return <EntityForm fields={fields} {...props} />;
}
// @sf-generated-end component:BpartnerDiscountForm

// @sf-custom-slot section:BpartnerDiscountForm-custom

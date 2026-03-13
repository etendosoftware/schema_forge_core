import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:invoiceDiscount
const fields = [
  { key: 'lineNo', column: 'Line', type: 'number', required: true, section: 'principal' },
  { key: 'discount', column: 'C_Discount_ID', type: 'selector', required: true, section: 'principal', reference: 'Discount', inputMode: 'selector' },
  { key: 'cascade', column: 'Cascade', type: 'checkbox', required: true, section: 'principal' },
];
// @sf-generated-end fields:invoiceDiscount

// @sf-generated-start component:InvoiceDiscountForm
export default function InvoiceDiscountForm(props) {
  // @sf-custom-slot hooks:InvoiceDiscountForm
  return <EntityForm fields={fields} {...props} />;
}
// @sf-generated-end component:InvoiceDiscountForm

// @sf-custom-slot section:InvoiceDiscountForm-custom

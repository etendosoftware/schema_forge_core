import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:basicDiscounts
const fields = [
  { key: 'lineNo', column: 'Line', type: 'number', label: 'Line No.', required: true, section: 'principal', defaultValue: '@SQL=SELECT COALESCE(MAX(LINE),0)+10 AS DefaultValue FROM C_ORDER_DISCOUNT WHERE C_ORDER_ID=@C_ORDER_ID@', readOnlyLogic: (record) => record['processed'] === true },
  { key: 'discount', column: 'C_Discount_ID', type: 'selector', label: 'Basic Discount', required: true, section: 'principal', reference: 'Discount', inputMode: 'selector', readOnlyLogic: (record) => record['processed'] === true },
  { key: 'cascade', column: 'Cascade', type: 'checkbox', label: 'Cascade', required: true, section: 'principal', defaultValue: 'N', readOnlyLogic: (record) => record['processed'] === true },
  { key: 'active', column: 'Isactive', type: 'checkbox', label: 'Active', required: true, section: 'principal', defaultValue: 'Y', readOnlyLogic: (record) => record['processed'] === true },
];
// @sf-generated-end fields:basicDiscounts

// @sf-generated-start component:BasicDiscountsForm
export default function BasicDiscountsForm(props) {
  return <EntityForm fields={fields} {...props} />;
}
BasicDiscountsForm.hasCollapsedFields = false;
// @sf-generated-end component:BasicDiscountsForm

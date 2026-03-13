import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:requisitionLine
const fields = [
  { key: 'product', column: 'M_Product_ID', type: 'search', required: true, section: 'principal', reference: 'Product', inputMode: 'search' },
  { key: 'quantity', column: 'Qty', type: 'number', required: true, section: 'principal' },
  { key: 'unitPrice', column: 'PriceActual', type: 'number', required: true, section: 'principal' },
  { key: 'lineNo', column: 'Line', type: 'number', required: true, section: 'principal' },
  { key: 'description', column: 'Description', type: 'textarea', section: 'other' },
  { key: 'needByDate', column: 'NeedByDate', type: 'date', section: 'other' },
  { key: 'businessPartner', column: 'C_BPartner_ID', type: 'search', section: 'other', reference: 'BusinessPartner', inputMode: 'search' },
  { key: 'lineNetAmount', column: 'LineNetAmt', type: 'number', readOnly: true, section: 'other' },
  { key: 'uom', column: 'C_UOM_ID', type: 'selector', readOnly: true, section: 'other', reference: 'UOM', inputMode: 'selector' },
];
// @sf-generated-end fields:requisitionLine

// @sf-generated-start component:RequisitionLineForm
export default function RequisitionLineForm(props) {
  // @sf-custom-slot hooks:RequisitionLineForm
  return <EntityForm fields={fields} {...props} />;
}
// @sf-generated-end component:RequisitionLineForm

// @sf-custom-slot section:RequisitionLineForm-custom

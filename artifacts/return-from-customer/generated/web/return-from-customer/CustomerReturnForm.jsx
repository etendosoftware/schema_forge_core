import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:customerReturn
const fields = [
  { key: 'grandTotalAmount', column: 'GrandTotal', type: 'number', required: true, readOnly: true, section: 'principal' },
  { key: 'summedLineAmount', column: 'TotalLines', type: 'number', required: true, readOnly: true, section: 'other' },
  { key: 'documentNo', column: 'DocumentNo', type: 'text', required: true, readOnly: true, section: 'principal' },
  { key: 'cReturnReasonID', column: 'C_Return_Reason_ID', type: 'search', section: 'principal', reference: 'Return_Reason', inputMode: 'search' },
  // @sf-custom-slot callout:SL_Order_UpdateLinesDate
  { key: 'orderDate', column: 'DateOrdered', type: 'date', required: true, section: 'principal' },
  // @sf-custom-slot callout:SE_Order_BPartner
  { key: 'businessPartner', column: 'C_BPartner_ID', type: 'search', required: true, section: 'principal', reference: 'BPartner', inputMode: 'search' },
  // @sf-custom-slot callout:SE_Order_BPartnerLocation
  { key: 'partnerAddress', column: 'C_BPartner_Location_ID', type: 'dependent', required: true, section: 'principal', reference: 'BPartner_Location', inputMode: 'dependent', dependsOn: { field: 'businessPartner', filterKey: 'C_BPartner_ID' } },
  { key: 'warehouse', column: 'M_Warehouse_ID', type: 'search', required: true, section: 'other', reference: 'Warehouse', inputMode: 'search' },
  { key: 'paymentTerms', column: 'C_PaymentTerm_ID', type: 'search', required: true, section: 'other', reference: 'PaymentTerm', inputMode: 'search' },
  { key: 'description', column: 'Description', type: 'textarea', section: 'other' },
  { key: 'paymentMethod', column: 'FIN_Paymentmethod_ID', type: 'search', section: 'other', reference: 'Paymentmethod', inputMode: 'search' },
  { key: 'salesRepresentative', column: 'SalesRep_ID', type: 'selector', section: 'other', reference: 'User', inputMode: 'selector' },
];
// @sf-generated-end fields:customerReturn

// @sf-generated-start component:CustomerReturnForm
export default function CustomerReturnForm(props) {
  // @sf-custom-slot hooks:CustomerReturnForm
  return <EntityForm fields={fields} {...props} />;
}
// @sf-generated-end component:CustomerReturnForm

// @sf-custom-slot section:CustomerReturnForm-custom

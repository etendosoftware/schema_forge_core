import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:order
const fields = [
  { key: 'documentNo', column: 'DocumentNo', type: 'text', required: true, readOnly: true, section: 'principal' },
  // @sf-custom-slot callout:SL_Order_UpdateLinesDate
  { key: 'orderDate', column: 'DateOrdered', type: 'date', required: true, section: 'principal', defaultValue: '@#Date@' },
  // @sf-custom-slot callout:SE_Order_BPartner
  { key: 'businessPartner', column: 'C_BPartner_ID', type: 'search', required: true, section: 'principal', reference: 'BusinessPartner', inputMode: 'search' },
  // @sf-custom-slot callout:SE_Order_BPartnerLocation
  { key: 'partnerAddress', column: 'C_BPartner_Location_ID', type: 'dependent', required: true, section: 'principal', reference: 'BusinessPartnerLocation', inputMode: 'dependent', dependsOn: { field: 'businessPartner', filterKey: 'C_BPartner_ID' } },
  // @sf-custom-slot callout:SL_Order_PriceList
  { key: 'priceList', column: 'M_PriceList_ID', type: 'selector', required: true, section: 'other', reference: 'PriceList', inputMode: 'selector' },
  // @sf-custom-slot callout:SL_Order_UpdateLinesDate
  { key: 'scheduledDeliveryDate', column: 'DatePromised', type: 'date', required: true, section: 'principal', defaultValue: '@#Date@' },
  { key: 'paymentMethod', column: 'FIN_Paymentmethod_ID', type: 'selector', section: 'other', reference: 'PaymentMethod', inputMode: 'selector' },
  { key: 'paymentTerms', column: 'C_PaymentTerm_ID', type: 'selector', required: true, section: 'principal', reference: 'PaymentTerm', inputMode: 'selector' },
  { key: 'warehouse', column: 'M_Warehouse_ID', type: 'search', required: true, section: 'other', reference: 'Warehouse', inputMode: 'search' },
  { key: 'grandTotalAmount', column: 'GrandTotal', type: 'number', required: true, readOnly: true, section: 'principal' },
  { key: 'summedLineAmount', column: 'TotalLines', type: 'number', required: true, readOnly: true, section: 'other' },
  { key: 'orderReference', column: 'POReference', type: 'text', section: 'other' },
  { key: 'salesRepresentative', column: 'SalesRep_ID', type: 'search', section: 'other', reference: 'SalesRepresentative', inputMode: 'search' },
  { key: 'description', column: 'Description', type: 'textarea', section: 'other' },
  { key: 'invoiceAddress', column: 'BillTo_ID', type: 'dependent', required: true, section: 'other', reference: 'BusinessPartnerLocation', inputMode: 'dependent', dependsOn: { field: 'businessPartner', filterKey: 'C_BPartner_ID' } },
  { key: 'quotation', column: 'Quotation_ID', type: 'search', readOnly: true, section: 'other', reference: 'Order', inputMode: 'search' },
  { key: 'cancelledorder', column: 'Cancelledorder_id', type: 'search', readOnly: true, section: 'other', reference: 'Order', inputMode: 'search' },
  { key: 'replacedorder', column: 'Replacedorder_id', type: 'search', readOnly: true, section: 'other', reference: 'Order', inputMode: 'search' },
  { key: 'isCanceled', column: 'Iscancelled', type: 'checkbox', required: true, readOnly: true, section: 'other', defaultValue: 'N' },
  { key: 'delivered', column: 'IsDelivered', type: 'checkbox', required: true, readOnly: true, section: 'other' },
];
// @sf-generated-end fields:order

// @sf-generated-start component:OrderForm
export default function OrderForm(props) {
  // @sf-custom-slot hooks:OrderForm
  return <EntityForm fields={fields} {...props} />;
}
// @sf-generated-end component:OrderForm

// @sf-custom-slot section:OrderForm-custom

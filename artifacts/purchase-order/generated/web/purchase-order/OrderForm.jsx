import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:order
const fields = [
  { key: 'documentStatus', column: 'DocStatus', type: 'text', required: true, readOnly: true },
  { key: 'orderDate', column: 'DateOrdered', type: 'date', required: true },
  { key: 'businessPartner', column: 'C_BPartner_ID', type: 'search', required: true, reference: 'BusinessPartner', inputMode: 'search' },
  { key: 'partnerAddress', column: 'C_BPartner_Location_ID', type: 'dependent', required: true, reference: 'BusinessPartnerLocation', inputMode: 'dependent', dependsOn: { field: 'businessPartner', filterKey: 'C_BPartner_ID' } },
  { key: 'warehouse', column: 'M_Warehouse_ID', type: 'selector', required: true, reference: 'Warehouse', inputMode: 'selector' },
  { key: 'scheduledDeliveryDate', column: 'DatePromised', type: 'date', required: true },
  { key: 'paymentMethod', column: 'FIN_Paymentmethod_ID', type: 'selector', reference: 'PaymentMethod', inputMode: 'selector' },
  { key: 'paymentTerms', column: 'C_PaymentTerm_ID', type: 'selector', required: true, reference: 'PaymentTerm', inputMode: 'selector' },
  { key: 'priceList', column: 'M_PriceList_ID', type: 'selector', required: true, reference: 'PriceList', inputMode: 'selector' },
  { key: 'invoiceAddress', column: 'BillTo_ID', type: 'dependent', required: true, reference: 'BusinessPartnerLocation', inputMode: 'dependent', dependsOn: { field: 'businessPartner', filterKey: 'C_BPartner_ID' } },
  { key: 'description', column: 'Description', type: 'textarea' },
  { key: 'deliveryNotes', column: 'Deliverynotes', type: 'textarea' },
  { key: 'orderReference', column: 'POReference', type: 'text' },
  { key: 'grandTotalAmount', column: 'GrandTotal', type: 'number', required: true, readOnly: true },
  { key: 'summedLineAmount', column: 'TotalLines', type: 'number', required: true, readOnly: true },
  { key: 'priceIncludesTax', column: 'IsTaxIncluded', type: 'checkbox', readOnly: true },
  { key: 'project', column: 'C_Project_ID', type: 'search', reference: 'Project', inputMode: 'search' },
  { key: 'costcenter', column: 'C_Costcenter_ID', type: 'selector', reference: 'CostCenter', inputMode: 'selector' },
  { key: 'asset', column: 'A_Asset_ID', type: 'selector', reference: 'Asset', inputMode: 'selector' },
  { key: 'stDimension', column: 'User1_ID', type: 'selector', reference: 'UserDimension1', inputMode: 'selector' },
  { key: 'ndDimension', column: 'User2_ID', type: 'selector', reference: 'UserDimension2', inputMode: 'selector' },
];
// @sf-generated-end fields:order

// @sf-generated-start component:OrderForm
export default function OrderForm(props) {
  // @sf-custom-slot hooks:OrderForm
  return <EntityForm fields={fields} {...props} />;
}
// @sf-generated-end component:OrderForm

// @sf-custom-slot section:OrderForm-custom

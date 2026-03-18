import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:order
const fields = [
  { key: 'transactionDocument', column: 'C_DocTypeTarget_ID', type: 'search', required: true, section: 'principal', reference: 'DocumentType', readOnlyLogic: (record) => record.processed === true },
  { key: 'documentStatus', column: 'DocStatus', type: 'text', required: true, readOnly: true, section: 'other' },
  { key: 'orderDate', column: 'DateOrdered', type: 'date', required: true, section: 'principal', readOnlyLogic: (record) => record.processed === true },
  { key: 'businessPartner', column: 'C_BPartner_ID', type: 'search', required: true, section: 'principal', reference: 'BusinessPartner', inputMode: 'search', readOnlyLogic: (record) => record.processed === true },
  { key: 'partnerAddress', column: 'C_BPartner_Location_ID', type: 'dependent', required: true, section: 'principal', reference: 'BusinessPartnerLocation', inputMode: 'dependent', dependsOn: { field: 'businessPartner', filterKey: 'C_BPartner_ID' }, readOnlyLogic: (record) => record.processed === true },
  { key: 'warehouse', column: 'M_Warehouse_ID', type: 'selector', required: true, section: 'other', reference: 'Warehouse', inputMode: 'selector', readOnlyLogic: (record) => record.processed === true },
  { key: 'scheduledDeliveryDate', column: 'DatePromised', type: 'date', required: true, section: 'other', readOnlyLogic: (record) => record.processed === true },
  { key: 'paymentMethod', column: 'FIN_Paymentmethod_ID', type: 'selector', section: 'other', reference: 'PaymentMethod', inputMode: 'selector', readOnlyLogic: (record) => record.processed === true },
  { key: 'paymentTerms', column: 'C_PaymentTerm_ID', type: 'selector', required: true, section: 'other', reference: 'PaymentTerm', inputMode: 'selector', readOnlyLogic: (record) => record.processed === true },
  { key: 'priceList', column: 'M_PriceList_ID', type: 'selector', required: true, section: 'other', reference: 'PriceList', inputMode: 'selector', readOnlyLogic: (record) => record.processed === true },
  { key: 'invoiceAddress', column: 'BillTo_ID', type: 'dependent', required: true, section: 'other', reference: 'BusinessPartnerLocation', inputMode: 'dependent', dependsOn: { field: 'businessPartner', filterKey: 'C_BPartner_ID' }, readOnlyLogic: (record) => record.processed === true },
  { key: 'description', column: 'Description', type: 'textarea', section: 'other', readOnlyLogic: (record) => record.processed === true },
  { key: 'deliveryNotes', column: 'Deliverynotes', type: 'textarea', section: 'other', readOnlyLogic: (record) => record.processed === true },
  { key: 'orderReference', column: 'POReference', type: 'text', section: 'other', readOnlyLogic: (record) => record.processed === true },
  { key: 'grandTotalAmount', column: 'GrandTotal', type: 'number', required: true, readOnly: true, section: 'other' },
  { key: 'summedLineAmount', column: 'TotalLines', type: 'number', required: true, readOnly: true, section: 'other' },
  { key: 'priceIncludesTax', column: 'IsTaxIncluded', type: 'checkbox', readOnly: true, section: 'other' },
  { key: 'project', column: 'C_Project_ID', type: 'search', section: 'other', reference: 'Project', inputMode: 'search' },
  { key: 'costcenter', column: 'C_Costcenter_ID', type: 'selector', section: 'other', reference: 'CostCenter', inputMode: 'selector' },
  { key: 'asset', column: 'A_Asset_ID', type: 'selector', section: 'other', reference: 'Asset', inputMode: 'selector' },
  { key: 'stDimension', column: 'User1_ID', type: 'selector', section: 'other', reference: 'UserDimension1', inputMode: 'selector' },
  { key: 'ndDimension', column: 'User2_ID', type: 'selector', section: 'other', reference: 'UserDimension2', inputMode: 'selector' },
];
// @sf-generated-end fields:order

// @sf-generated-start component:OrderForm
export default function OrderForm(props) {
  // @sf-custom-slot hooks:OrderForm
  return <EntityForm fields={fields} {...props} />;
}
// @sf-generated-end component:OrderForm

// @sf-custom-slot section:OrderForm-custom

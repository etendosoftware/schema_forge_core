import { ListView, DetailView } from '@/components/contract-ui';
import OrderTable from './OrderTable';
import OrderForm from './OrderForm';
import OrderLineTable from './OrderLineTable';
import OrderLineForm from './OrderLineForm';
import RelatedDocuments from './RelatedDocuments';
import catalogs from './mockCatalogs';

const breadcrumb = 'Sales / Sales Order';

// @sf-generated-start summary:order
const summary = [
  { key: 'documentNo', column: 'DocumentNo', type: 'string' },
  { key: 'grandTotalAmount', column: 'GrandTotal', type: 'amount' },
  { key: 'summedLineAmount', column: 'TotalLines', type: 'amount' },
];

const statusField = 'documentStatus';
// @sf-generated-end summary:order

// @sf-custom-start extraBadges:order
const extraBadges = [
  { key: 'delivered', label: 'Delivered', style: 'default', when: true },
  { key: 'reinvoice', label: 'Invoiced', style: 'default', when: true },
];
// @sf-custom-end extraBadges:order

// @sf-generated-start processes:order
const processes = [
  { name: 'Process Order', label: 'Process  Order', style: 'positive' },
];
// @sf-generated-end processes:order

// @sf-generated-start addLineFields:orderLine
const addLineFields = {
  entry: [
    { key: 'product', column: 'M_Product_ID', type: 'search', required: true, lookup: true, reference: 'Product', inputMode: 'search' },
    { key: 'orderedQuantity', column: 'QtyOrdered', type: 'text', required: true },
    { key: 'description', column: 'Description', type: 'textarea' },
  ],
  derived: [
    { key: 'unitPrice', column: 'PriceActual', type: 'text' },
    { key: 'lineNetAmount', column: 'LineNetAmt', type: 'number' },
    { key: 'tax', column: 'C_Tax_ID', type: 'search', reference: 'Tax', inputMode: 'search' },
    { key: 'discount', column: 'Discount', type: 'text' },
  ],
};
// @sf-generated-end addLineFields:orderLine

const api = {
  "specName": "sales-order",
  "baseUrl": "/sws/neo/sales-order",
  "crud": {
    "order": {
      "get": true,
      "getById": true,
      "post": true,
      "put": true,
      "patch": true,
      "delete": true,
      "listUrl": "/sws/neo/sales-order/order",
      "detailUrl": "/sws/neo/sales-order/order/{id}",
      "supportedFilters": [
        "documentNo",
        "orderDate",
        "businessPartner",
        "documentStatus",
        "orderReference"
      ]
    },
    "orderLine": {
      "get": true,
      "getById": true,
      "post": true,
      "put": true,
      "patch": true,
      "delete": true,
      "listUrl": "/sws/neo/sales-order/orderLine",
      "detailUrl": "/sws/neo/sales-order/orderLine/{id}",
      "supportedFilters": [
        "product"
      ]
    }
  },
  "selectors": [
    {
      "entity": "order",
      "field": "businessPartner",
      "column": "C_BPartner_ID",
      "reference": "BusinessPartner",
      "inputMode": "search",
      "url": "/sws/neo/sales-order/order/selectors/businessPartner"
    },
    {
      "entity": "order",
      "field": "partnerAddress",
      "column": "C_BPartner_Location_ID",
      "reference": "BusinessPartnerLocation",
      "inputMode": "dependent",
      "url": "/sws/neo/sales-order/order/selectors/partnerAddress"
    },
    {
      "entity": "order",
      "field": "paymentMethod",
      "column": "FIN_Paymentmethod_ID",
      "reference": "PaymentMethod",
      "inputMode": "selector",
      "url": "/sws/neo/sales-order/order/selectors/paymentMethod"
    },
    {
      "entity": "order",
      "field": "currency",
      "column": "C_Currency_ID",
      "reference": "Currency",
      "inputMode": "selector",
      "url": "/sws/neo/sales-order/order/selectors/currency"
    },
    {
      "entity": "orderLine",
      "field": "product",
      "column": "M_Product_ID",
      "reference": "Product",
      "inputMode": "search",
      "url": "/sws/neo/sales-order/orderLine/selectors/product"
    },
    {
      "entity": "orderLine",
      "field": "tax",
      "column": "C_Tax_ID",
      "reference": "Tax",
      "inputMode": "search",
      "url": "/sws/neo/sales-order/orderLine/selectors/tax"
    }
  ],
  "actions": [
    {
      "entity": "order",
      "field": "rMPickFromShipment",
      "column": "RM_PickFromShipment",
      "url": "/sws/neo/sales-order/order/{id}/action/rMPickFromShipment"
    },
    {
      "entity": "order",
      "field": "rMReceiveMaterials",
      "column": "RM_ReceiveMaterials",
      "url": "/sws/neo/sales-order/order/{id}/action/rMReceiveMaterials"
    },
    {
      "entity": "order",
      "field": "rMCreateInvoice",
      "column": "RM_CreateInvoice",
      "url": "/sws/neo/sales-order/order/{id}/action/rMCreateInvoice"
    },
    {
      "entity": "order",
      "field": "aPRMAddPayment",
      "column": "EM_APRM_AddPayment",
      "url": "/sws/neo/sales-order/order/{id}/action/aPRMAddPayment"
    },
    {
      "entity": "order",
      "field": "documentAction",
      "column": "DocAction",
      "url": "/sws/neo/sales-order/order/{id}/action/documentAction"
    },
    {
      "entity": "order",
      "field": "copyFrom",
      "column": "CopyFrom",
      "url": "/sws/neo/sales-order/order/{id}/action/copyFrom"
    },
    {
      "entity": "order",
      "field": "copyFromPO",
      "column": "CopyFromPO",
      "url": "/sws/neo/sales-order/order/{id}/action/copyFromPO"
    },
    {
      "entity": "order",
      "field": "calculatePromotions",
      "column": "Calculate_Promotions",
      "url": "/sws/neo/sales-order/order/{id}/action/calculatePromotions"
    },
    {
      "entity": "order",
      "field": "rMAddOrphanLine",
      "column": "RM_AddOrphanLine",
      "url": "/sws/neo/sales-order/order/{id}/action/rMAddOrphanLine"
    },
    {
      "entity": "order",
      "field": "createOrder",
      "column": "Convertquotation",
      "url": "/sws/neo/sales-order/order/{id}/action/createOrder"
    },
    {
      "entity": "order",
      "field": "cancelAndReplace",
      "column": "Cancelandreplace",
      "url": "/sws/neo/sales-order/order/{id}/action/cancelAndReplace"
    },
    {
      "entity": "order",
      "field": "confirmCancelAndReplace",
      "column": "Confirmcancelandreplace",
      "url": "/sws/neo/sales-order/order/{id}/action/confirmCancelAndReplace"
    },
    {
      "entity": "order",
      "field": "generateTemplate",
      "column": "Generatetemplate",
      "url": "/sws/neo/sales-order/order/{id}/action/generateTemplate"
    },
    {
      "entity": "order",
      "field": "posted",
      "column": "Posted",
      "url": "/sws/neo/sales-order/order/{id}/action/posted"
    },
    {
      "entity": "order",
      "field": "processNow",
      "column": "Processing",
      "url": "/sws/neo/sales-order/order/{id}/action/processNow"
    },
    {
      "entity": "order",
      "field": "createPOLines",
      "column": "Create_POLines",
      "url": "/sws/neo/sales-order/order/{id}/action/createPOLines"
    },
    {
      "entity": "order",
      "field": "rMPickfromreceipt",
      "column": "RM_Pickfromreceipt",
      "url": "/sws/neo/sales-order/order/{id}/action/rMPickfromreceipt"
    },
    {
      "entity": "orderLine",
      "field": "manageReservation",
      "column": "Manage_Reservation",
      "url": "/sws/neo/sales-order/orderLine/{id}/action/manageReservation"
    },
    {
      "entity": "orderLine",
      "field": "explode",
      "column": "Explode",
      "url": "/sws/neo/sales-order/orderLine/{id}/action/explode"
    },
    {
      "entity": "orderLine",
      "field": "selectOrderLine",
      "column": "Relate_Orderline",
      "url": "/sws/neo/sales-order/orderLine/{id}/action/selectOrderLine"
    },
    {
      "entity": "orderLine",
      "field": "managePrereservation",
      "column": "Manage_Prereservation",
      "url": "/sws/neo/sales-order/orderLine/{id}/action/managePrereservation"
    }
  ],
  "queryParams": {
    "pagination": {
      "startRow": "_startRow",
      "endRow": "_endRow",
      "default": "0-100"
    },
    "sorting": {
      "param": "_sortBy",
      "example": "_sortBy=sales-orderDate"
    },
    "filtering": "Use field name as query param: ?fieldName=value",
    "parentFilter": "parentId={id} for child entities"
  }
};

// @sf-generated-start component:OrderPage
export default function OrderPage({ windowName, recordId, ...props }) {
  // @sf-custom-slot hooks:OrderPage
  if (recordId) {
    return (
      <DetailView
        entity="order"
        detailEntity="orderLine"
        Form={OrderForm}
        DetailTable={OrderLineTable}
        DetailForm={OrderLineForm}
        summary={summary}
        statusField={statusField}
        extraBadges={extraBadges}
        processes={processes}
        addLineFields={addLineFields}
        catalogs={catalogs}
        entityLabel="Order"
        detailLabel="Lines"
        windowName={windowName}
        recordId={recordId}
        breadcrumb={breadcrumb}
      api={api}
        customTabs={[
          { key: 'related', label: 'Related Documents', Component: RelatedDocuments },
        ]}
        {...props}
      />
    );
  }

  return (
    <ListView
      entity="order"
      Table={OrderTable}
      entityLabel="Orders"
      windowName={windowName}
      breadcrumb={breadcrumb}
      api={api}
      {...props}
    />
  );
}
// @sf-generated-end component:OrderPage

// @sf-custom-slot section:OrderPage-custom

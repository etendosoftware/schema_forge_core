import { ListView, DetailView } from '@/components/contract-ui';
import OrderTable from './OrderTable';
import OrderForm from './OrderForm';
import OrderLineTable from './OrderLineTable';
import catalogs from './mockCatalogs';

const summary = [
  { key: 'documentNo', column: 'DocumentNo', type: 'string' },
  { key: 'grandTotalAmount', column: 'GrandTotal', type: 'amount' },
  { key: 'summedLineAmount', column: 'TotalLines', type: 'amount' },
  { key: 'currency', column: 'C_Currency_ID', type: 'string' },
  { key: 'delivered', column: 'IsDelivered', type: 'boolean' },
  { key: 'quotation', column: 'Quotation_ID', type: 'string' },
  { key: 'cancelled', column: 'Iscancelled', type: 'boolean' },
];

const statusField = 'documentStatus';

const processes = [

];

const addLineFields = {
  entry: [
    { key: 'product', column: 'M_Product_ID', type: 'search', required: true, lookup: true, reference: 'Product', inputMode: 'search' },
    { key: 'orderedQuantity', column: 'QtyOrdered', type: 'number', required: true },
    { key: 'description', column: 'Description', type: 'textarea' },
    { key: 'lineNo', column: 'Line', type: 'number', required: true },
  ],
  derived: [
    { key: 'unitPrice', column: 'PriceActual', type: 'number' },
    { key: 'tax', column: 'C_Tax_ID', type: 'selector', reference: 'Tax', inputMode: 'selector' },
    { key: 'discount', column: 'Discount', type: 'number' },
  ],
};

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
        "businessPartner",
        "orderDate",
        "documentNo",
        "documentStatus"
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
      "url": "/sws/neo/sales-order/order/selectors/businessPartner"
    },
    {
      "entity": "order",
      "field": "partnerAddress",
      "column": "C_BPartner_Location_ID",
      "reference": "BusinessPartnerLocation",
      "url": "/sws/neo/sales-order/order/selectors/partnerAddress"
    },
    {
      "entity": "order",
      "field": "warehouse",
      "column": "M_Warehouse_ID",
      "reference": "Warehouse",
      "url": "/sws/neo/sales-order/order/selectors/warehouse"
    },
    {
      "entity": "order",
      "field": "priceList",
      "column": "M_PriceList_ID",
      "reference": "PriceList",
      "url": "/sws/neo/sales-order/order/selectors/priceList"
    },
    {
      "entity": "order",
      "field": "paymentTerms",
      "column": "C_PaymentTerm_ID",
      "reference": "PaymentTerm",
      "url": "/sws/neo/sales-order/order/selectors/paymentTerms"
    },
    {
      "entity": "order",
      "field": "paymentMethod",
      "column": "FIN_Paymentmethod_ID",
      "reference": "PaymentMethod",
      "url": "/sws/neo/sales-order/order/selectors/paymentMethod"
    },
    {
      "entity": "order",
      "field": "invoiceAddress",
      "column": "BillTo_ID",
      "reference": "BusinessPartnerLocation",
      "url": "/sws/neo/sales-order/order/selectors/invoiceAddress"
    },
    {
      "entity": "order",
      "field": "deliveryLocation",
      "column": "DeliveryLocation",
      "reference": "Location",
      "url": "/sws/neo/sales-order/order/selectors/deliveryLocation"
    },
    {
      "entity": "order",
      "field": "salesRepresentative",
      "column": "SalesRep_ID",
      "reference": "User",
      "url": "/sws/neo/sales-order/order/selectors/salesRepresentative"
    },
    {
      "entity": "order",
      "field": "currency",
      "column": "C_Currency_ID",
      "reference": "Currency",
      "url": "/sws/neo/sales-order/order/selectors/currency"
    },
    {
      "entity": "order",
      "field": "quotation",
      "column": "Quotation_ID",
      "reference": "Order",
      "url": "/sws/neo/sales-order/order/selectors/quotation"
    },
    {
      "entity": "orderLine",
      "field": "product",
      "column": "M_Product_ID",
      "reference": "Product",
      "url": "/sws/neo/sales-order/orderLine/selectors/product"
    },
    {
      "entity": "orderLine",
      "field": "tax",
      "column": "C_Tax_ID",
      "reference": "Tax",
      "url": "/sws/neo/sales-order/orderLine/selectors/tax"
    },
    {
      "entity": "orderLine",
      "field": "uOM",
      "column": "C_UOM_ID",
      "reference": "UOM",
      "url": "/sws/neo/sales-order/orderLine/selectors/uOM"
    }
  ],
  "actions": [],
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

export default function OrderPage({ windowName, recordId, ...props }) {
  if (recordId) {
    return (
      <DetailView
        entity="order"
        detailEntity="orderLine"
        Form={OrderForm}
        DetailTable={OrderLineTable}
        summary={summary}
        statusField={statusField}
        processes={processes}
        addLineFields={addLineFields}
        catalogs={catalogs}
        entityLabel="Order"
        detailLabel="Order Line"
        windowName={windowName}
        recordId={recordId}
      api={api}
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
      {...props}
    />
  );
}

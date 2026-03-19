import { ListView, DetailView } from '@/components/contract-ui';
import OrderTable from './OrderTable';
import OrderForm from './OrderForm';
import OrderLineTable from './OrderLineTable';
import catalogs from './mockCatalogs';

const breadcrumb = 'Sales / Sales Order';

// @sf-generated-start summary:order
const summary = [
  { key: 'quotation', column: 'Quotation_ID', type: 'string' },
  { key: 'canceledOrder', column: 'Cancelledorder_id', type: 'string' },
  { key: 'replacedOrder', column: 'Replacedorder_id', type: 'string' },
  { key: 'isCanceled', column: 'Iscancelled', type: 'boolean' },
  { key: 'crmReference', column: 'BPartner_ExtRef', type: 'string' },
];

const statusField = null;
// @sf-generated-end summary:order

// @sf-generated-start processes:order
const processes = [

];
// @sf-generated-end processes:order

// @sf-generated-start addLineFields:orderLine
const addLineFields = {
  entry: [
    { key: 'product', column: 'M_Product_ID', type: 'search', required: true, lookup: true, reference: 'Product', inputMode: 'search' },
    { key: 'orderedQuantity', column: 'QtyOrdered', type: 'text', required: true },
    { key: 'operativeQuantity', column: 'Aumqty', type: 'text' },
    { key: 'alternativeUOM', column: 'C_Aum', type: 'search', reference: 'UOM', inputMode: 'search' },
    { key: 'warehouseRule', column: 'M_Warehouse_Rule_ID', type: 'selector', reference: 'WarehouseRule', inputMode: 'selector' },
    { key: 'description', column: 'Description', type: 'textarea' },
    { key: 'stockReservation', column: 'Create_Reservation', type: 'text' },
    { key: 'attributeSetValue', column: 'M_AttributeSetInstance_ID', type: 'text' },
    { key: 'manageReservation', column: 'Manage_Reservation', type: 'text' },
    { key: 'explode', column: 'Explode', type: 'text' },
    { key: 'selectOrderLine', column: 'Relate_Orderline', type: 'text', required: true },
    { key: 'project', column: 'C_Project_ID', type: 'search', reference: 'Project', inputMode: 'search' },
    { key: 'asset', column: 'A_Asset_ID', type: 'search', reference: 'Asset', inputMode: 'search' },
    { key: 'dimension1', column: 'User1_ID', type: 'search', reference: 'UserDimension1', inputMode: 'search' },
    { key: 'dimension2', column: 'User2_ID', type: 'search', reference: 'UserDimension2', inputMode: 'search' },
    { key: 'lineNo', column: 'Line', type: 'number', required: true },
    { key: 'overdueReturnDays', column: 'Overdue_Return_Days', type: 'number' },
  ],
  derived: [
    { key: 'netUnitPrice', column: 'PriceActual', type: 'text' },
    { key: 'grossUnitPrice', column: 'Gross_Unit_Price', type: 'text' },
    { key: 'lineNetAmount', column: 'LineNetAmt', type: 'number' },
    { key: 'tax', column: 'C_Tax_ID', type: 'search', reference: 'Tax', inputMode: 'search' },
    { key: 'netListPrice', column: 'PriceList', type: 'text' },
    { key: 'discount', column: 'Discount', type: 'text' },
    { key: 'alternateTaxableAmount', column: 'Taxbaseamt', type: 'number' },
    { key: 'cancelDiscountsAndPromotions', column: 'CANCELPRICEAD', type: 'checkbox' },
    { key: 'costCenter', column: 'C_Costcenter_ID', type: 'search', reference: 'CostCenter', inputMode: 'search' },
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
        "businessPartner",
        "orderDate",
        "orderReference",
        "totalGrossAmount"
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
    },
    "orderLineTax": {
      "get": true,
      "getById": true,
      "post": true,
      "put": true,
      "patch": true,
      "delete": true,
      "listUrl": "/sws/neo/sales-order/orderLineTax",
      "detailUrl": "/sws/neo/sales-order/orderLineTax/{id}",
      "supportedFilters": []
    },
    "reservedStock": {
      "get": true,
      "getById": true,
      "post": true,
      "put": true,
      "patch": true,
      "delete": true,
      "listUrl": "/sws/neo/sales-order/reservedStock",
      "detailUrl": "/sws/neo/sales-order/reservedStock/{id}",
      "supportedFilters": []
    },
    "relatedProducts": {
      "get": true,
      "getById": true,
      "post": true,
      "put": true,
      "patch": true,
      "delete": true,
      "listUrl": "/sws/neo/sales-order/relatedProducts",
      "detailUrl": "/sws/neo/sales-order/relatedProducts/{id}",
      "supportedFilters": []
    },
    "relatedServices": {
      "get": true,
      "getById": true,
      "post": true,
      "put": true,
      "patch": true,
      "delete": true,
      "listUrl": "/sws/neo/sales-order/relatedServices",
      "detailUrl": "/sws/neo/sales-order/relatedServices/{id}",
      "supportedFilters": []
    },
    "basicDiscounts": {
      "get": true,
      "getById": true,
      "post": true,
      "put": true,
      "patch": true,
      "delete": true,
      "listUrl": "/sws/neo/sales-order/basicDiscounts",
      "detailUrl": "/sws/neo/sales-order/basicDiscounts/{id}",
      "supportedFilters": []
    },
    "orderTax": {
      "get": true,
      "getById": true,
      "post": true,
      "put": true,
      "patch": true,
      "delete": true,
      "listUrl": "/sws/neo/sales-order/orderTax",
      "detailUrl": "/sws/neo/sales-order/orderTax/{id}",
      "supportedFilters": []
    },
    "paymentPlan": {
      "get": true,
      "getById": true,
      "post": true,
      "put": true,
      "patch": true,
      "delete": true,
      "listUrl": "/sws/neo/sales-order/paymentPlan",
      "detailUrl": "/sws/neo/sales-order/paymentPlan/{id}",
      "supportedFilters": []
    },
    "paymentDetails": {
      "get": true,
      "getById": true,
      "post": true,
      "put": true,
      "patch": true,
      "delete": true,
      "listUrl": "/sws/neo/sales-order/paymentDetails",
      "detailUrl": "/sws/neo/sales-order/paymentDetails/{id}",
      "supportedFilters": []
    },
    "replacementOrders": {
      "get": true,
      "getById": true,
      "post": true,
      "put": true,
      "patch": true,
      "delete": true,
      "listUrl": "/sws/neo/sales-order/replacementOrders",
      "detailUrl": "/sws/neo/sales-order/replacementOrders/{id}",
      "supportedFilters": []
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
      "field": "priceList",
      "column": "M_PriceList_ID",
      "reference": "PriceList",
      "url": "/sws/neo/sales-order/order/selectors/priceList"
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
      "field": "paymentTerms",
      "column": "C_PaymentTerm_ID",
      "reference": "PaymentTerm",
      "url": "/sws/neo/sales-order/order/selectors/paymentTerms"
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
      "field": "salesRepresentative",
      "column": "SalesRep_ID",
      "reference": "SalesRepresentative",
      "url": "/sws/neo/sales-order/order/selectors/salesRepresentative"
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
      "column": "Delivery_Location_ID",
      "reference": "BusinessPartnerLocation",
      "url": "/sws/neo/sales-order/order/selectors/deliveryLocation"
    },
    {
      "entity": "order",
      "field": "project",
      "column": "C_Project_ID",
      "reference": "Project",
      "url": "/sws/neo/sales-order/order/selectors/project"
    },
    {
      "entity": "order",
      "field": "costCenter",
      "column": "C_Costcenter_ID",
      "reference": "CostCenter",
      "url": "/sws/neo/sales-order/order/selectors/costCenter"
    },
    {
      "entity": "order",
      "field": "asset",
      "column": "A_Asset_ID",
      "reference": "Asset",
      "url": "/sws/neo/sales-order/order/selectors/asset"
    },
    {
      "entity": "order",
      "field": "dimension1",
      "column": "User1_ID",
      "reference": "UserDimension1",
      "url": "/sws/neo/sales-order/order/selectors/dimension1"
    },
    {
      "entity": "order",
      "field": "dimension2",
      "column": "User2_ID",
      "reference": "UserDimension2",
      "url": "/sws/neo/sales-order/order/selectors/dimension2"
    },
    {
      "entity": "order",
      "field": "quotation",
      "column": "Quotation_ID",
      "reference": "Order",
      "url": "/sws/neo/sales-order/order/selectors/quotation"
    },
    {
      "entity": "order",
      "field": "canceledOrder",
      "column": "Cancelledorder_id",
      "reference": "Order",
      "url": "/sws/neo/sales-order/order/selectors/canceledOrder"
    },
    {
      "entity": "order",
      "field": "replacedOrder",
      "column": "Replacedorder_id",
      "reference": "Order",
      "url": "/sws/neo/sales-order/order/selectors/replacedOrder"
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
      "field": "alternativeUOM",
      "column": "C_Aum",
      "reference": "UOM",
      "url": "/sws/neo/sales-order/orderLine/selectors/alternativeUOM"
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
      "field": "warehouseRule",
      "column": "M_Warehouse_Rule_ID",
      "reference": "WarehouseRule",
      "url": "/sws/neo/sales-order/orderLine/selectors/warehouseRule"
    },
    {
      "entity": "orderLine",
      "field": "project",
      "column": "C_Project_ID",
      "reference": "Project",
      "url": "/sws/neo/sales-order/orderLine/selectors/project"
    },
    {
      "entity": "orderLine",
      "field": "costCenter",
      "column": "C_Costcenter_ID",
      "reference": "CostCenter",
      "url": "/sws/neo/sales-order/orderLine/selectors/costCenter"
    },
    {
      "entity": "orderLine",
      "field": "asset",
      "column": "A_Asset_ID",
      "reference": "Asset",
      "url": "/sws/neo/sales-order/orderLine/selectors/asset"
    },
    {
      "entity": "orderLine",
      "field": "dimension1",
      "column": "User1_ID",
      "reference": "UserDimension1",
      "url": "/sws/neo/sales-order/orderLine/selectors/dimension1"
    },
    {
      "entity": "orderLine",
      "field": "dimension2",
      "column": "User2_ID",
      "reference": "UserDimension2",
      "url": "/sws/neo/sales-order/orderLine/selectors/dimension2"
    },
    {
      "entity": "orderLine",
      "field": "uom",
      "column": "C_UOM_ID",
      "reference": "UOM",
      "url": "/sws/neo/sales-order/orderLine/selectors/uom"
    },
    {
      "entity": "orderLine",
      "field": "replacedOrderLine",
      "column": "Replacedorderline_id",
      "reference": "OrderLine",
      "url": "/sws/neo/sales-order/orderLine/selectors/replacedOrderLine"
    },
    {
      "entity": "orderLine",
      "field": "quotationLine",
      "column": "Quotationline_ID",
      "reference": "OrderLine",
      "url": "/sws/neo/sales-order/orderLine/selectors/quotationLine"
    },
    {
      "entity": "orderLineTax",
      "field": "tax",
      "column": "C_Tax_ID",
      "reference": "Tax",
      "url": "/sws/neo/sales-order/orderLineTax/selectors/tax"
    },
    {
      "entity": "reservedStock",
      "field": "stockReservation",
      "column": "M_Reservation_ID",
      "reference": "Reservation",
      "url": "/sws/neo/sales-order/reservedStock/selectors/stockReservation"
    },
    {
      "entity": "reservedStock",
      "field": "storageBin",
      "column": "M_Locator_ID",
      "reference": "Locator",
      "url": "/sws/neo/sales-order/reservedStock/selectors/storageBin"
    },
    {
      "entity": "reservedStock",
      "field": "purchaseOrderLine",
      "column": "C_Orderline_ID",
      "reference": "OrderLine",
      "url": "/sws/neo/sales-order/reservedStock/selectors/purchaseOrderLine"
    },
    {
      "entity": "reservedStock",
      "field": "vendor",
      "column": "C_BPartner_ID",
      "reference": "BusinessPartner",
      "url": "/sws/neo/sales-order/reservedStock/selectors/vendor"
    },
    {
      "entity": "relatedProducts",
      "field": "product",
      "column": "M_Product_ID",
      "reference": "Product",
      "url": "/sws/neo/sales-order/relatedProducts/selectors/product"
    },
    {
      "entity": "relatedServices",
      "field": "product",
      "column": "product",
      "reference": "Product",
      "url": "/sws/neo/sales-order/relatedServices/selectors/product"
    },
    {
      "entity": "basicDiscounts",
      "field": "basicDiscount",
      "column": "C_Discount_ID",
      "reference": "Discount",
      "url": "/sws/neo/sales-order/basicDiscounts/selectors/basicDiscount"
    },
    {
      "entity": "orderTax",
      "field": "tax",
      "column": "C_Tax_ID",
      "reference": "Tax",
      "url": "/sws/neo/sales-order/orderTax/selectors/tax"
    },
    {
      "entity": "paymentPlan",
      "field": "paymentMethod",
      "column": "FIN_Paymentmethod_ID",
      "reference": "PaymentMethod",
      "url": "/sws/neo/sales-order/paymentPlan/selectors/paymentMethod"
    },
    {
      "entity": "paymentPlan",
      "field": "currency",
      "column": "C_Currency_ID",
      "reference": "Currency",
      "url": "/sws/neo/sales-order/paymentPlan/selectors/currency"
    },
    {
      "entity": "paymentDetails",
      "field": "paymentIn",
      "column": "FIN_Payment_ID",
      "reference": "Payment",
      "url": "/sws/neo/sales-order/paymentDetails/selectors/paymentIn"
    },
    {
      "entity": "paymentDetails",
      "field": "paymentMethod",
      "column": "EM_APRM_Displayed_Paymmeth_ID",
      "reference": "PaymentMethod",
      "url": "/sws/neo/sales-order/paymentDetails/selectors/paymentMethod"
    },
    {
      "entity": "paymentDetails",
      "field": "financialAccount",
      "column": "EM_APRM_Displayed_Acc_ID",
      "reference": "FinancialAccount",
      "url": "/sws/neo/sales-order/paymentDetails/selectors/financialAccount"
    },
    {
      "entity": "replacementOrders",
      "field": "replacementOrder",
      "column": "C_Replacement_ID",
      "reference": "Order",
      "url": "/sws/neo/sales-order/replacementOrders/selectors/replacementOrder"
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
        summary={summary}
        statusField={statusField}
        processes={processes}
        addLineFields={addLineFields}
        catalogs={catalogs}
        entityLabel="Order"
        detailLabel="Order Line"
        windowName={windowName}
        recordId={recordId}
        breadcrumb={breadcrumb}
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
      breadcrumb={breadcrumb}
      {...props}
    />
  );
}
// @sf-generated-end component:OrderPage

// @sf-custom-slot section:OrderPage-custom

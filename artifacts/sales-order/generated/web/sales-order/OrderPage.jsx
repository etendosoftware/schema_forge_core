import { ListView, DetailView } from '@/components/contract-ui';
import OrderTable from './OrderTable';
import OrderForm from './OrderForm';
import OrderLineTable from './OrderLineTable';
import OrderLineForm from './OrderLineForm';
import OrderTaxTable from './OrderTaxTable';
import OrderTaxForm from './OrderTaxForm';
import PaymentPlanTable from './PaymentPlanTable';
import PaymentPlanForm from './PaymentPlanForm';
import catalogs from './mockCatalogs';

const breadcrumb = 'Sales / Sales Order';

// @sf-generated-start summary:order
const summary = [
  { key: 'grandTotalAmount', column: 'GrandTotal', type: 'amount' },
  { key: 'summedLineAmount', column: 'TotalLines', type: 'amount' },
  { key: 'currency', column: 'C_Currency_ID', type: 'string' },
  { key: 'reservationStatus', column: 'SO_Res_Status', type: 'status' },
  { key: 'deliveryStatus', column: 'DeliveryStatus', type: 'status' },
  { key: 'quotation', column: 'Quotation_ID', type: 'string' },
  { key: 'invoiceStatus', column: 'InvoiceStatus', type: 'status' },
  { key: 'cancelledorder', column: 'Cancelledorder_id', type: 'string' },
  { key: 'replacedorder', column: 'Replacedorder_id', type: 'string' },
  { key: 'isCanceled', column: 'Iscancelled', type: 'boolean' },
  { key: 'externalBusinessPartnerReference', column: 'BPartner_ExtRef', type: 'string' },
  { key: 'delivered', column: 'IsDelivered', type: 'boolean' },
];

const statusField = 'documentStatus';
// @sf-generated-end summary:order

// @sf-generated-start processes:order
const processes = [

];
// @sf-generated-end processes:order

// @sf-generated-start addLineFields:orderLine
const addLineFields = {
  entry: [
    { key: 'lineNo', column: 'Line', type: 'number', required: true, lookup: true },
    { key: 'product', column: 'M_Product_ID', type: 'search', required: true, reference: 'Product', inputMode: 'search' },
    { key: 'operativeQuantity', column: 'Aumqty', type: 'text' },
    { key: 'operativeUOM', column: 'C_Aum', type: 'dependent', reference: 'UOM', inputMode: 'dependent', dependsOn: { field: 'product', filterKey: 'M_Product_ID' } },
    { key: 'orderedQuantity', column: 'QtyOrdered', type: 'text', required: true },
    { key: 'attributeSetValue', column: 'M_AttributeSetInstance_ID', type: 'text' },
    { key: 'warehouseRule', column: 'M_Warehouse_Rule_ID', type: 'selector', reference: 'WarehouseRule', inputMode: 'selector' },
    { key: 'description', column: 'Description', type: 'textarea' },
    { key: 'stockReservation', column: 'Create_Reservation', type: 'text' },
    { key: 'manageReservation', column: 'Manage_Reservation', type: 'text' },
    { key: 'overdueReturnDays', column: 'Overdue_Return_Days', type: 'number' },
    { key: 'project', column: 'C_Project_ID', type: 'search', reference: 'Project', inputMode: 'search' },
    { key: 'asset', column: 'A_Asset_ID', type: 'search', reference: 'Asset', inputMode: 'search' },
    { key: 'stDimension', column: 'User1_ID', type: 'selector', reference: 'User1', inputMode: 'selector' },
    { key: 'ndDimension', column: 'User2_ID', type: 'selector', reference: 'User2', inputMode: 'selector' },
    { key: 'explode', column: 'Explode', type: 'text' },
    { key: 'selectOrderLine', column: 'Relate_Orderline', type: 'text', required: true },
  ],
  derived: [
    { key: 'unitPrice', column: 'PriceActual', type: 'text' },
    { key: 'grossUnitPrice', column: 'Gross_Unit_Price', type: 'text' },
    { key: 'lineNetAmount', column: 'LineNetAmt', type: 'number' },
    { key: 'tax', column: 'C_Tax_ID', type: 'search', reference: 'Tax', inputMode: 'search' },
    { key: 'listPrice', column: 'PriceList', type: 'text' },
    { key: 'discount', column: 'Discount', type: 'text' },
    { key: 'taxableAmount', column: 'Taxbaseamt', type: 'number' },
    { key: 'cancelPriceAdjustment', column: 'CANCELPRICEAD', type: 'checkbox' },
    { key: 'costcenter', column: 'C_Costcenter_ID', type: 'selector', reference: 'Costcenter', inputMode: 'selector' },
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
        "orderDate",
        "businessPartner",
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
      "field": "priceList",
      "column": "M_PriceList_ID",
      "reference": "PriceList",
      "inputMode": "selector",
      "url": "/sws/neo/sales-order/order/selectors/priceList"
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
      "field": "paymentTerms",
      "column": "C_PaymentTerm_ID",
      "reference": "PaymentTerm",
      "inputMode": "selector",
      "url": "/sws/neo/sales-order/order/selectors/paymentTerms"
    },
    {
      "entity": "order",
      "field": "warehouse",
      "column": "M_Warehouse_ID",
      "reference": "Warehouse",
      "inputMode": "search",
      "url": "/sws/neo/sales-order/order/selectors/warehouse"
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
      "entity": "order",
      "field": "salesRepresentative",
      "column": "SalesRep_ID",
      "reference": "SalesRepresentative",
      "inputMode": "search",
      "url": "/sws/neo/sales-order/order/selectors/salesRepresentative"
    },
    {
      "entity": "order",
      "field": "invoiceAddress",
      "column": "BillTo_ID",
      "reference": "BusinessPartnerLocation",
      "inputMode": "dependent",
      "url": "/sws/neo/sales-order/order/selectors/invoiceAddress"
    },
    {
      "entity": "order",
      "field": "deliveryLocation",
      "column": "Delivery_Location_ID",
      "reference": "BusinessPartnerLocation",
      "inputMode": "dependent",
      "url": "/sws/neo/sales-order/order/selectors/deliveryLocation"
    },
    {
      "entity": "order",
      "field": "quotation",
      "column": "Quotation_ID",
      "reference": "Order",
      "inputMode": "search",
      "url": "/sws/neo/sales-order/order/selectors/quotation"
    },
    {
      "entity": "order",
      "field": "cancelledorder",
      "column": "Cancelledorder_id",
      "reference": "Order",
      "inputMode": "search",
      "url": "/sws/neo/sales-order/order/selectors/cancelledorder"
    },
    {
      "entity": "order",
      "field": "replacedorder",
      "column": "Replacedorder_id",
      "reference": "Order",
      "inputMode": "search",
      "url": "/sws/neo/sales-order/order/selectors/replacedorder"
    },
    {
      "entity": "order",
      "field": "project",
      "column": "C_Project_ID",
      "reference": "Project",
      "inputMode": "dependent",
      "url": "/sws/neo/sales-order/order/selectors/project"
    },
    {
      "entity": "order",
      "field": "costcenter",
      "column": "C_Costcenter_ID",
      "reference": "Costcenter",
      "inputMode": "selector",
      "url": "/sws/neo/sales-order/order/selectors/costcenter"
    },
    {
      "entity": "order",
      "field": "asset",
      "column": "A_Asset_ID",
      "reference": "Asset",
      "inputMode": "search",
      "url": "/sws/neo/sales-order/order/selectors/asset"
    },
    {
      "entity": "order",
      "field": "stDimension",
      "column": "User1_ID",
      "reference": "User1",
      "inputMode": "selector",
      "url": "/sws/neo/sales-order/order/selectors/stDimension"
    },
    {
      "entity": "order",
      "field": "ndDimension",
      "column": "User2_ID",
      "reference": "User2",
      "inputMode": "selector",
      "url": "/sws/neo/sales-order/order/selectors/ndDimension"
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
      "field": "operativeUOM",
      "column": "C_Aum",
      "reference": "UOM",
      "inputMode": "dependent",
      "url": "/sws/neo/sales-order/orderLine/selectors/operativeUOM"
    },
    {
      "entity": "orderLine",
      "field": "uOM",
      "column": "C_UOM_ID",
      "reference": "UOM",
      "inputMode": "selector",
      "url": "/sws/neo/sales-order/orderLine/selectors/uOM"
    },
    {
      "entity": "orderLine",
      "field": "tax",
      "column": "C_Tax_ID",
      "reference": "Tax",
      "inputMode": "search",
      "url": "/sws/neo/sales-order/orderLine/selectors/tax"
    },
    {
      "entity": "orderLine",
      "field": "warehouseRule",
      "column": "M_Warehouse_Rule_ID",
      "reference": "WarehouseRule",
      "inputMode": "selector",
      "url": "/sws/neo/sales-order/orderLine/selectors/warehouseRule"
    },
    {
      "entity": "orderLine",
      "field": "replacedorderline",
      "column": "Replacedorderline_id",
      "reference": "OrderLine",
      "inputMode": "search",
      "url": "/sws/neo/sales-order/orderLine/selectors/replacedorderline"
    },
    {
      "entity": "orderLine",
      "field": "quotationLine",
      "column": "Quotationline_ID",
      "reference": "OrderLine",
      "inputMode": "search",
      "url": "/sws/neo/sales-order/orderLine/selectors/quotationLine"
    },
    {
      "entity": "orderLine",
      "field": "project",
      "column": "C_Project_ID",
      "reference": "Project",
      "inputMode": "search",
      "url": "/sws/neo/sales-order/orderLine/selectors/project"
    },
    {
      "entity": "orderLine",
      "field": "costcenter",
      "column": "C_Costcenter_ID",
      "reference": "Costcenter",
      "inputMode": "selector",
      "url": "/sws/neo/sales-order/orderLine/selectors/costcenter"
    },
    {
      "entity": "orderLine",
      "field": "asset",
      "column": "A_Asset_ID",
      "reference": "Asset",
      "inputMode": "search",
      "url": "/sws/neo/sales-order/orderLine/selectors/asset"
    },
    {
      "entity": "orderLine",
      "field": "stDimension",
      "column": "User1_ID",
      "reference": "User1",
      "inputMode": "selector",
      "url": "/sws/neo/sales-order/orderLine/selectors/stDimension"
    },
    {
      "entity": "orderLine",
      "field": "ndDimension",
      "column": "User2_ID",
      "reference": "User2",
      "inputMode": "selector",
      "url": "/sws/neo/sales-order/orderLine/selectors/ndDimension"
    },
    {
      "entity": "orderLineTax",
      "field": "tax",
      "column": "C_Tax_ID",
      "reference": "Tax",
      "inputMode": "selector",
      "url": "/sws/neo/sales-order/orderLineTax/selectors/tax"
    },
    {
      "entity": "reservedStock",
      "field": "stockReservation",
      "column": "M_Reservation_ID",
      "reference": "Reservation",
      "inputMode": "search",
      "url": "/sws/neo/sales-order/reservedStock/selectors/stockReservation"
    },
    {
      "entity": "reservedStock",
      "field": "storageBin",
      "column": "M_Locator_ID",
      "reference": "Locator",
      "inputMode": "search",
      "url": "/sws/neo/sales-order/reservedStock/selectors/storageBin"
    },
    {
      "entity": "reservedStock",
      "field": "salesOrderLine",
      "column": "C_Orderline_ID",
      "reference": "Orderline",
      "inputMode": "search",
      "url": "/sws/neo/sales-order/reservedStock/selectors/salesOrderLine"
    },
    {
      "entity": "reservedStock",
      "field": "businessPartner",
      "column": "C_BPartner_ID",
      "reference": "BPartner",
      "inputMode": "search",
      "url": "/sws/neo/sales-order/reservedStock/selectors/businessPartner"
    },
    {
      "entity": "relatedServices",
      "field": "product",
      "column": "product",
      "reference": "Product",
      "inputMode": "search",
      "url": "/sws/neo/sales-order/relatedServices/selectors/product"
    },
    {
      "entity": "relatedProducts",
      "field": "product",
      "column": "M_Product_ID",
      "reference": "Product",
      "inputMode": "search",
      "url": "/sws/neo/sales-order/relatedProducts/selectors/product"
    },
    {
      "entity": "orderTax",
      "field": "tax",
      "column": "C_Tax_ID",
      "reference": "Tax",
      "inputMode": "selector",
      "url": "/sws/neo/sales-order/orderTax/selectors/tax"
    },
    {
      "entity": "paymentPlan",
      "field": "paymentMethod",
      "column": "FIN_Paymentmethod_ID",
      "reference": "PaymentMethod",
      "inputMode": "search",
      "url": "/sws/neo/sales-order/paymentPlan/selectors/paymentMethod"
    },
    {
      "entity": "paymentPlan",
      "field": "currency",
      "column": "C_Currency_ID",
      "reference": "Currency",
      "inputMode": "search",
      "url": "/sws/neo/sales-order/paymentPlan/selectors/currency"
    },
    {
      "entity": "paymentDetails",
      "field": "payment",
      "column": "FIN_Payment_ID",
      "reference": "Payment",
      "inputMode": "selector",
      "url": "/sws/neo/sales-order/paymentDetails/selectors/payment"
    },
    {
      "entity": "replacementOrders",
      "field": "cReplacementID",
      "column": "C_Replacement_ID",
      "reference": "Order",
      "inputMode": "search",
      "url": "/sws/neo/sales-order/replacementOrders/selectors/cReplacementID"
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
    },
    {
      "entity": "paymentPlan",
      "field": "updatePaymentPlan",
      "column": "Update_Payment_Plan",
      "url": "/sws/neo/sales-order/paymentPlan/{id}/action/updatePaymentPlan"
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
        processes={processes}
        addLineFields={addLineFields}
        catalogs={catalogs}
        entityLabel="Order"
        detailLabel="Lines"
        windowName={windowName}
        recordId={recordId}
        breadcrumb={breadcrumb}
      api={api}
        secondaryTabs={[
          { key: 'orderTax', label: 'Tax', Table: OrderTaxTable, Form: OrderTaxForm },
          { key: 'paymentPlan', label: 'Payment Plan', Table: PaymentPlanTable, Form: PaymentPlanForm },
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

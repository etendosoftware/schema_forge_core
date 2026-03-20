import { ListView, DetailView } from '@/components/contract-ui';
import HeaderTable from './HeaderTable';
import HeaderForm from './HeaderForm';
import LinesTable from './LinesTable';
import LinesForm from './LinesForm';
import BasicDiscountsTable from './BasicDiscountsTable';
import BasicDiscountsForm from './BasicDiscountsForm';
import PaymentPlanTable from './PaymentPlanTable';
import PaymentPlanForm from './PaymentPlanForm';
import catalogs from './mockCatalogs';

const breadcrumb = 'Sales / Sales Order';

// @sf-generated-start summary:header
const summary = [
  { key: 'grandTotalAmount', column: 'GrandTotal', type: 'amount' },
  { key: 'summedLineAmount', column: 'TotalLines', type: 'amount' },
  { key: 'currency', column: 'C_Currency_ID', type: 'string' },
  { key: 'reservationStatus', column: 'SO_Res_Status', type: 'status' },
  { key: 'quotation', column: 'Quotation_ID', type: 'string' },
  { key: 'deliveryStatus', column: 'DeliveryStatus', type: 'status' },
  { key: 'invoiceStatus', column: 'InvoiceStatus', type: 'status' },
  { key: 'cancelledorder', column: 'Cancelledorder_id', type: 'string' },
  { key: 'replacedorder', column: 'Replacedorder_id', type: 'string' },
  { key: 'isCanceled', column: 'Iscancelled', type: 'boolean' },
  { key: 'externalBusinessPartnerReference', column: 'BPartner_ExtRef', type: 'string' },
  { key: 'delivered', column: 'IsDelivered', type: 'boolean' },
];

const statusField = 'documentStatus';
// @sf-generated-end summary:header

// @sf-generated-start processes:header
const processes = [

];
// @sf-generated-end processes:header

// @sf-generated-start addLineFields:lines
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
// @sf-generated-end addLineFields:lines

const api = {
  "specName": "sales-order",
  "baseUrl": "/sws/neo/sales-order",
  "crud": {
    "header": {
      "get": true,
      "getById": true,
      "post": true,
      "put": true,
      "patch": true,
      "delete": true,
      "listUrl": "/sws/neo/sales-order/header",
      "detailUrl": "/sws/neo/sales-order/header/{id}",
      "supportedFilters": [
        "orderDate",
        "businessPartner",
        "orderReference"
      ]
    },
    "lines": {
      "get": true,
      "getById": true,
      "post": true,
      "put": true,
      "patch": true,
      "delete": true,
      "listUrl": "/sws/neo/sales-order/lines",
      "detailUrl": "/sws/neo/sales-order/lines/{id}",
      "supportedFilters": [
        "product"
      ]
    },
    "lineTax": {
      "get": true,
      "getById": true,
      "post": true,
      "put": true,
      "patch": true,
      "delete": true,
      "listUrl": "/sws/neo/sales-order/lineTax",
      "detailUrl": "/sws/neo/sales-order/lineTax/{id}",
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
    "tax": {
      "get": true,
      "getById": true,
      "post": true,
      "put": true,
      "patch": true,
      "delete": true,
      "listUrl": "/sws/neo/sales-order/tax",
      "detailUrl": "/sws/neo/sales-order/tax/{id}",
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
      "entity": "header",
      "field": "businessPartner",
      "column": "C_BPartner_ID",
      "reference": "BusinessPartner",
      "inputMode": "search",
      "url": "/sws/neo/sales-order/header/selectors/businessPartner"
    },
    {
      "entity": "header",
      "field": "partnerAddress",
      "column": "C_BPartner_Location_ID",
      "reference": "BusinessPartnerLocation",
      "inputMode": "dependent",
      "url": "/sws/neo/sales-order/header/selectors/partnerAddress"
    },
    {
      "entity": "header",
      "field": "priceList",
      "column": "M_PriceList_ID",
      "reference": "PriceList",
      "inputMode": "selector",
      "url": "/sws/neo/sales-order/header/selectors/priceList"
    },
    {
      "entity": "header",
      "field": "paymentMethod",
      "column": "FIN_Paymentmethod_ID",
      "reference": "PaymentMethod",
      "inputMode": "selector",
      "url": "/sws/neo/sales-order/header/selectors/paymentMethod"
    },
    {
      "entity": "header",
      "field": "paymentTerms",
      "column": "C_PaymentTerm_ID",
      "reference": "PaymentTerm",
      "inputMode": "selector",
      "url": "/sws/neo/sales-order/header/selectors/paymentTerms"
    },
    {
      "entity": "header",
      "field": "warehouse",
      "column": "M_Warehouse_ID",
      "reference": "Warehouse",
      "inputMode": "search",
      "url": "/sws/neo/sales-order/header/selectors/warehouse"
    },
    {
      "entity": "header",
      "field": "currency",
      "column": "C_Currency_ID",
      "reference": "Currency",
      "inputMode": "selector",
      "url": "/sws/neo/sales-order/header/selectors/currency"
    },
    {
      "entity": "header",
      "field": "salesRepresentative",
      "column": "SalesRep_ID",
      "reference": "SalesRepresentative",
      "inputMode": "search",
      "url": "/sws/neo/sales-order/header/selectors/salesRepresentative"
    },
    {
      "entity": "header",
      "field": "invoiceAddress",
      "column": "BillTo_ID",
      "reference": "BusinessPartnerLocation",
      "inputMode": "dependent",
      "url": "/sws/neo/sales-order/header/selectors/invoiceAddress"
    },
    {
      "entity": "header",
      "field": "deliveryLocation",
      "column": "Delivery_Location_ID",
      "reference": "BusinessPartnerLocation",
      "inputMode": "dependent",
      "url": "/sws/neo/sales-order/header/selectors/deliveryLocation"
    },
    {
      "entity": "header",
      "field": "quotation",
      "column": "Quotation_ID",
      "reference": "Order",
      "inputMode": "search",
      "url": "/sws/neo/sales-order/header/selectors/quotation"
    },
    {
      "entity": "header",
      "field": "cancelledorder",
      "column": "Cancelledorder_id",
      "reference": "Order",
      "inputMode": "search",
      "url": "/sws/neo/sales-order/header/selectors/cancelledorder"
    },
    {
      "entity": "header",
      "field": "replacedorder",
      "column": "Replacedorder_id",
      "reference": "Order",
      "inputMode": "search",
      "url": "/sws/neo/sales-order/header/selectors/replacedorder"
    },
    {
      "entity": "header",
      "field": "project",
      "column": "C_Project_ID",
      "reference": "Project",
      "inputMode": "dependent",
      "url": "/sws/neo/sales-order/header/selectors/project"
    },
    {
      "entity": "header",
      "field": "costcenter",
      "column": "C_Costcenter_ID",
      "reference": "Costcenter",
      "inputMode": "selector",
      "url": "/sws/neo/sales-order/header/selectors/costcenter"
    },
    {
      "entity": "header",
      "field": "asset",
      "column": "A_Asset_ID",
      "reference": "Asset",
      "inputMode": "search",
      "url": "/sws/neo/sales-order/header/selectors/asset"
    },
    {
      "entity": "header",
      "field": "stDimension",
      "column": "User1_ID",
      "reference": "User1",
      "inputMode": "selector",
      "url": "/sws/neo/sales-order/header/selectors/stDimension"
    },
    {
      "entity": "header",
      "field": "ndDimension",
      "column": "User2_ID",
      "reference": "User2",
      "inputMode": "selector",
      "url": "/sws/neo/sales-order/header/selectors/ndDimension"
    },
    {
      "entity": "lines",
      "field": "product",
      "column": "M_Product_ID",
      "reference": "Product",
      "inputMode": "search",
      "url": "/sws/neo/sales-order/lines/selectors/product"
    },
    {
      "entity": "lines",
      "field": "operativeUOM",
      "column": "C_Aum",
      "reference": "UOM",
      "inputMode": "dependent",
      "url": "/sws/neo/sales-order/lines/selectors/operativeUOM"
    },
    {
      "entity": "lines",
      "field": "uOM",
      "column": "C_UOM_ID",
      "reference": "UOM",
      "inputMode": "selector",
      "url": "/sws/neo/sales-order/lines/selectors/uOM"
    },
    {
      "entity": "lines",
      "field": "tax",
      "column": "C_Tax_ID",
      "reference": "Tax",
      "inputMode": "search",
      "url": "/sws/neo/sales-order/lines/selectors/tax"
    },
    {
      "entity": "lines",
      "field": "warehouseRule",
      "column": "M_Warehouse_Rule_ID",
      "reference": "WarehouseRule",
      "inputMode": "selector",
      "url": "/sws/neo/sales-order/lines/selectors/warehouseRule"
    },
    {
      "entity": "lines",
      "field": "replacedorderline",
      "column": "Replacedorderline_id",
      "reference": "OrderLine",
      "inputMode": "search",
      "url": "/sws/neo/sales-order/lines/selectors/replacedorderline"
    },
    {
      "entity": "lines",
      "field": "quotationLine",
      "column": "Quotationline_ID",
      "reference": "OrderLine",
      "inputMode": "search",
      "url": "/sws/neo/sales-order/lines/selectors/quotationLine"
    },
    {
      "entity": "lines",
      "field": "project",
      "column": "C_Project_ID",
      "reference": "Project",
      "inputMode": "search",
      "url": "/sws/neo/sales-order/lines/selectors/project"
    },
    {
      "entity": "lines",
      "field": "costcenter",
      "column": "C_Costcenter_ID",
      "reference": "Costcenter",
      "inputMode": "selector",
      "url": "/sws/neo/sales-order/lines/selectors/costcenter"
    },
    {
      "entity": "lines",
      "field": "asset",
      "column": "A_Asset_ID",
      "reference": "Asset",
      "inputMode": "search",
      "url": "/sws/neo/sales-order/lines/selectors/asset"
    },
    {
      "entity": "lines",
      "field": "stDimension",
      "column": "User1_ID",
      "reference": "User1",
      "inputMode": "selector",
      "url": "/sws/neo/sales-order/lines/selectors/stDimension"
    },
    {
      "entity": "lines",
      "field": "ndDimension",
      "column": "User2_ID",
      "reference": "User2",
      "inputMode": "selector",
      "url": "/sws/neo/sales-order/lines/selectors/ndDimension"
    },
    {
      "entity": "lineTax",
      "field": "tax",
      "column": "C_Tax_ID",
      "reference": "Tax",
      "inputMode": "selector",
      "url": "/sws/neo/sales-order/lineTax/selectors/tax"
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
      "entity": "basicDiscounts",
      "field": "discount",
      "column": "C_Discount_ID",
      "reference": "Discount",
      "inputMode": "selector",
      "url": "/sws/neo/sales-order/basicDiscounts/selectors/discount"
    },
    {
      "entity": "tax",
      "field": "tax",
      "column": "C_Tax_ID",
      "reference": "Tax",
      "inputMode": "selector",
      "url": "/sws/neo/sales-order/tax/selectors/tax"
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
      "entity": "header",
      "field": "rMPickFromShipment",
      "column": "RM_PickFromShipment",
      "url": "/sws/neo/sales-order/header/{id}/action/rMPickFromShipment"
    },
    {
      "entity": "header",
      "field": "rMReceiveMaterials",
      "column": "RM_ReceiveMaterials",
      "url": "/sws/neo/sales-order/header/{id}/action/rMReceiveMaterials"
    },
    {
      "entity": "header",
      "field": "rMCreateInvoice",
      "column": "RM_CreateInvoice",
      "url": "/sws/neo/sales-order/header/{id}/action/rMCreateInvoice"
    },
    {
      "entity": "header",
      "field": "aPRMAddPayment",
      "column": "EM_APRM_AddPayment",
      "url": "/sws/neo/sales-order/header/{id}/action/aPRMAddPayment"
    },
    {
      "entity": "header",
      "field": "documentAction",
      "column": "DocAction",
      "url": "/sws/neo/sales-order/header/{id}/action/documentAction"
    },
    {
      "entity": "header",
      "field": "copyFrom",
      "column": "CopyFrom",
      "url": "/sws/neo/sales-order/header/{id}/action/copyFrom"
    },
    {
      "entity": "header",
      "field": "copyFromPO",
      "column": "CopyFromPO",
      "url": "/sws/neo/sales-order/header/{id}/action/copyFromPO"
    },
    {
      "entity": "header",
      "field": "calculatePromotions",
      "column": "Calculate_Promotions",
      "url": "/sws/neo/sales-order/header/{id}/action/calculatePromotions"
    },
    {
      "entity": "header",
      "field": "rMAddOrphanLine",
      "column": "RM_AddOrphanLine",
      "url": "/sws/neo/sales-order/header/{id}/action/rMAddOrphanLine"
    },
    {
      "entity": "header",
      "field": "createOrder",
      "column": "Convertquotation",
      "url": "/sws/neo/sales-order/header/{id}/action/createOrder"
    },
    {
      "entity": "header",
      "field": "cancelAndReplace",
      "column": "Cancelandreplace",
      "url": "/sws/neo/sales-order/header/{id}/action/cancelAndReplace"
    },
    {
      "entity": "header",
      "field": "confirmCancelAndReplace",
      "column": "Confirmcancelandreplace",
      "url": "/sws/neo/sales-order/header/{id}/action/confirmCancelAndReplace"
    },
    {
      "entity": "header",
      "field": "posted",
      "column": "Posted",
      "url": "/sws/neo/sales-order/header/{id}/action/posted"
    },
    {
      "entity": "header",
      "field": "generateTemplate",
      "column": "Generatetemplate",
      "url": "/sws/neo/sales-order/header/{id}/action/generateTemplate"
    },
    {
      "entity": "header",
      "field": "processNow",
      "column": "Processing",
      "url": "/sws/neo/sales-order/header/{id}/action/processNow"
    },
    {
      "entity": "header",
      "field": "createPOLines",
      "column": "Create_POLines",
      "url": "/sws/neo/sales-order/header/{id}/action/createPOLines"
    },
    {
      "entity": "header",
      "field": "rMPickfromreceipt",
      "column": "RM_Pickfromreceipt",
      "url": "/sws/neo/sales-order/header/{id}/action/rMPickfromreceipt"
    },
    {
      "entity": "lines",
      "field": "manageReservation",
      "column": "Manage_Reservation",
      "url": "/sws/neo/sales-order/lines/{id}/action/manageReservation"
    },
    {
      "entity": "lines",
      "field": "explode",
      "column": "Explode",
      "url": "/sws/neo/sales-order/lines/{id}/action/explode"
    },
    {
      "entity": "lines",
      "field": "selectOrderLine",
      "column": "Relate_Orderline",
      "url": "/sws/neo/sales-order/lines/{id}/action/selectOrderLine"
    },
    {
      "entity": "lines",
      "field": "managePrereservation",
      "column": "Manage_Prereservation",
      "url": "/sws/neo/sales-order/lines/{id}/action/managePrereservation"
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

// @sf-generated-start component:HeaderPage
export default function HeaderPage({ windowName, recordId, ...props }) {
  // @sf-custom-slot hooks:HeaderPage
  if (recordId) {
    return (
      <DetailView
        entity="header"
        detailEntity="lines"
        Form={HeaderForm}
        DetailTable={LinesTable}
        DetailForm={LinesForm}
        summary={summary}
        statusField={statusField}
        processes={processes}
        addLineFields={addLineFields}
        catalogs={catalogs}
        entityLabel="Header"
        detailLabel="Lines"
        windowName={windowName}
        recordId={recordId}
        breadcrumb={breadcrumb}
      api={api}
        secondaryTabs={[
          { key: 'basicDiscounts', label: 'Basic Discounts', Table: BasicDiscountsTable, Form: BasicDiscountsForm },
          { key: 'paymentPlan', label: 'Payment Plan', Table: PaymentPlanTable, Form: PaymentPlanForm },
        ]}
        {...props}
      />
    );
  }

  return (
    <ListView
      entity="header"
      Table={HeaderTable}
      entityLabel="Headers"
      windowName={windowName}
      breadcrumb={breadcrumb}
      api={api}
      {...props}
    />
  );
}
// @sf-generated-end component:HeaderPage

// @sf-custom-slot section:HeaderPage-custom

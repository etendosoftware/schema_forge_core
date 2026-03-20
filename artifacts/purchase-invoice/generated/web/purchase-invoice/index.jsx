import InvoicePage from './InvoicePage';

const windowMeta = { category: 'purchases', name: 'Purchase Invoice' };

const api = {
  "specName": "purchase-invoice",
  "baseUrl": "/sws/neo/purchase-invoice",
  "crud": {
    "invoice": {
      "get": true,
      "getById": true,
      "post": true,
      "put": true,
      "patch": true,
      "delete": true,
      "listUrl": "/sws/neo/purchase-invoice/invoice",
      "detailUrl": "/sws/neo/purchase-invoice/invoice/{id}",
      "supportedFilters": [
        "documentNo",
        "invoiceDate",
        "businessPartner",
        "orderReference",
        "documentStatus"
      ]
    },
    "invoiceLine": {
      "get": true,
      "getById": true,
      "post": true,
      "put": true,
      "patch": true,
      "delete": true,
      "listUrl": "/sws/neo/purchase-invoice/invoiceLine",
      "detailUrl": "/sws/neo/purchase-invoice/invoiceLine/{id}",
      "supportedFilters": []
    },
    "invoiceTax": {
      "get": true,
      "getById": true,
      "post": true,
      "put": true,
      "patch": true,
      "delete": true,
      "listUrl": "/sws/neo/purchase-invoice/invoiceTax",
      "detailUrl": "/sws/neo/purchase-invoice/invoiceTax/{id}",
      "supportedFilters": []
    },
    "basicDiscounts": {
      "get": true,
      "getById": true,
      "post": true,
      "put": true,
      "patch": true,
      "delete": true,
      "listUrl": "/sws/neo/purchase-invoice/basicDiscounts",
      "detailUrl": "/sws/neo/purchase-invoice/basicDiscounts/{id}",
      "supportedFilters": []
    },
    "paymentPlan": {
      "get": true,
      "getById": true,
      "post": true,
      "put": true,
      "patch": true,
      "delete": true,
      "listUrl": "/sws/neo/purchase-invoice/paymentPlan",
      "detailUrl": "/sws/neo/purchase-invoice/paymentPlan/{id}",
      "supportedFilters": []
    },
    "accounting": {
      "get": true,
      "getById": true,
      "post": true,
      "put": true,
      "patch": true,
      "delete": true,
      "listUrl": "/sws/neo/purchase-invoice/accounting",
      "detailUrl": "/sws/neo/purchase-invoice/accounting/{id}",
      "supportedFilters": []
    },
    "reversedInvoices": {
      "get": true,
      "getById": true,
      "post": true,
      "put": true,
      "patch": true,
      "delete": true,
      "listUrl": "/sws/neo/purchase-invoice/reversedInvoices",
      "detailUrl": "/sws/neo/purchase-invoice/reversedInvoices/{id}",
      "supportedFilters": []
    }
  },
  "selectors": [
    {
      "entity": "invoice",
      "field": "transactionDocument",
      "column": "C_DocTypeTarget_ID",
      "reference": "DocumentType",
      "url": "/sws/neo/purchase-invoice/invoice/selectors/transactionDocument"
    },
    {
      "entity": "invoice",
      "field": "businessPartner",
      "column": "C_BPartner_ID",
      "reference": "BusinessPartner",
      "url": "/sws/neo/purchase-invoice/invoice/selectors/businessPartner"
    },
    {
      "entity": "invoice",
      "field": "partnerAddress",
      "column": "C_BPartner_Location_ID",
      "reference": "BusinessPartnerLocation",
      "url": "/sws/neo/purchase-invoice/invoice/selectors/partnerAddress"
    },
    {
      "entity": "invoice",
      "field": "currency",
      "column": "C_Currency_ID",
      "reference": "Currency",
      "url": "/sws/neo/purchase-invoice/invoice/selectors/currency"
    },
    {
      "entity": "invoice",
      "field": "paymentTerms",
      "column": "C_PaymentTerm_ID",
      "reference": "PaymentTerm",
      "url": "/sws/neo/purchase-invoice/invoice/selectors/paymentTerms"
    },
    {
      "entity": "invoice",
      "field": "paymentMethod",
      "column": "FIN_Paymentmethod_ID",
      "reference": "PaymentMethod",
      "url": "/sws/neo/purchase-invoice/invoice/selectors/paymentMethod"
    },
    {
      "entity": "invoice",
      "field": "priceList",
      "column": "M_PriceList_ID",
      "reference": "PriceList",
      "url": "/sws/neo/purchase-invoice/invoice/selectors/priceList"
    },
    {
      "entity": "invoice",
      "field": "userContact",
      "column": "AD_User_ID",
      "reference": "User",
      "url": "/sws/neo/purchase-invoice/invoice/selectors/userContact"
    },
    {
      "entity": "invoice",
      "field": "salesRepresentative",
      "column": "SalesRep_ID",
      "reference": "User",
      "url": "/sws/neo/purchase-invoice/invoice/selectors/salesRepresentative"
    },
    {
      "entity": "invoice",
      "field": "charge",
      "column": "C_Charge_ID",
      "reference": "Charge",
      "url": "/sws/neo/purchase-invoice/invoice/selectors/charge"
    },
    {
      "entity": "invoice",
      "field": "project",
      "column": "C_Project_ID",
      "reference": "Project",
      "url": "/sws/neo/purchase-invoice/invoice/selectors/project"
    },
    {
      "entity": "invoice",
      "field": "costcenter",
      "column": "C_Costcenter_ID",
      "reference": "CostCenter",
      "url": "/sws/neo/purchase-invoice/invoice/selectors/costcenter"
    },
    {
      "entity": "invoice",
      "field": "asset",
      "column": "A_Asset_ID",
      "reference": "Asset",
      "url": "/sws/neo/purchase-invoice/invoice/selectors/asset"
    },
    {
      "entity": "invoice",
      "field": "stDimension",
      "column": "User1_ID",
      "reference": "UserDimension1",
      "url": "/sws/neo/purchase-invoice/invoice/selectors/stDimension"
    },
    {
      "entity": "invoice",
      "field": "ndDimension",
      "column": "User2_ID",
      "reference": "UserDimension2",
      "url": "/sws/neo/purchase-invoice/invoice/selectors/ndDimension"
    },
    {
      "entity": "invoice",
      "field": "salesOrder",
      "column": "C_Order_ID",
      "reference": "Order",
      "url": "/sws/neo/purchase-invoice/invoice/selectors/salesOrder"
    },
    {
      "entity": "invoiceLine",
      "field": "product",
      "column": "M_Product_ID",
      "reference": "Product",
      "url": "/sws/neo/purchase-invoice/invoiceLine/selectors/product"
    },
    {
      "entity": "invoiceLine",
      "field": "account",
      "column": "Account_ID",
      "reference": "GLAccount",
      "url": "/sws/neo/purchase-invoice/invoiceLine/selectors/account"
    },
    {
      "entity": "invoiceLine",
      "field": "attributeSetValue",
      "column": "M_AttributeSetInstance_ID",
      "reference": "AttributeSetInstance",
      "url": "/sws/neo/purchase-invoice/invoiceLine/selectors/attributeSetValue"
    },
    {
      "entity": "invoiceLine",
      "field": "operativeUOM",
      "column": "C_Aum",
      "reference": "UOM",
      "url": "/sws/neo/purchase-invoice/invoiceLine/selectors/operativeUOM"
    },
    {
      "entity": "invoiceLine",
      "field": "uOM",
      "column": "C_UOM_ID",
      "reference": "UOM",
      "url": "/sws/neo/purchase-invoice/invoiceLine/selectors/uOM"
    },
    {
      "entity": "invoiceLine",
      "field": "tax",
      "column": "C_Tax_ID",
      "reference": "Tax",
      "url": "/sws/neo/purchase-invoice/invoiceLine/selectors/tax"
    },
    {
      "entity": "invoiceLine",
      "field": "salesOrderLine",
      "column": "C_OrderLine_ID",
      "reference": "OrderLine",
      "url": "/sws/neo/purchase-invoice/invoiceLine/selectors/salesOrderLine"
    },
    {
      "entity": "invoiceLine",
      "field": "goodsShipmentLine",
      "column": "M_InOutLine_ID",
      "reference": "GoodsShipmentLine",
      "url": "/sws/neo/purchase-invoice/invoiceLine/selectors/goodsShipmentLine"
    },
    {
      "entity": "invoiceLine",
      "field": "project",
      "column": "C_Project_ID",
      "reference": "Project",
      "url": "/sws/neo/purchase-invoice/invoiceLine/selectors/project"
    },
    {
      "entity": "invoiceLine",
      "field": "costcenter",
      "column": "C_Costcenter_ID",
      "reference": "CostCenter",
      "url": "/sws/neo/purchase-invoice/invoiceLine/selectors/costcenter"
    },
    {
      "entity": "invoiceLine",
      "field": "asset",
      "column": "A_Asset_ID",
      "reference": "Asset",
      "url": "/sws/neo/purchase-invoice/invoiceLine/selectors/asset"
    },
    {
      "entity": "invoiceLine",
      "field": "stDimension",
      "column": "User1_ID",
      "reference": "UserDimension1",
      "url": "/sws/neo/purchase-invoice/invoiceLine/selectors/stDimension"
    },
    {
      "entity": "invoiceLine",
      "field": "ndDimension",
      "column": "User2_ID",
      "reference": "UserDimension2",
      "url": "/sws/neo/purchase-invoice/invoiceLine/selectors/ndDimension"
    },
    {
      "entity": "invoiceTax",
      "field": "tax",
      "column": "C_Tax_ID",
      "reference": "Tax",
      "url": "/sws/neo/purchase-invoice/invoiceTax/selectors/tax"
    },
    {
      "entity": "basicDiscounts",
      "field": "discount",
      "column": "C_Discount_ID",
      "reference": "Discount",
      "url": "/sws/neo/purchase-invoice/basicDiscounts/selectors/discount"
    },
    {
      "entity": "paymentPlan",
      "field": "paymentMethod",
      "column": "Fin_Paymentmethod_ID",
      "reference": "PaymentMethod",
      "url": "/sws/neo/purchase-invoice/paymentPlan/selectors/paymentMethod"
    },
    {
      "entity": "paymentPlan",
      "field": "currency",
      "column": "C_Currency_ID",
      "reference": "Currency",
      "url": "/sws/neo/purchase-invoice/paymentPlan/selectors/currency"
    },
    {
      "entity": "reversedInvoices",
      "field": "reversedInvoice",
      "column": "Reversed_C_Invoice_ID",
      "reference": "Invoice",
      "url": "/sws/neo/purchase-invoice/reversedInvoices/selectors/reversedInvoice"
    }
  ],
  "actions": [
    {
      "entity": "invoice",
      "field": "generateTo",
      "column": "GenerateTo",
      "url": "/sws/neo/purchase-invoice/invoice/{id}/action/generateTo"
    },
    {
      "entity": "invoice",
      "field": "eMAPRMAddpayment",
      "column": "EM_APRM_Addpayment",
      "url": "/sws/neo/purchase-invoice/invoice/{id}/action/eMAPRMAddpayment"
    },
    {
      "entity": "invoice",
      "field": "eMAPRMProcessinvoice",
      "column": "EM_APRM_Processinvoice",
      "url": "/sws/neo/purchase-invoice/invoice/{id}/action/eMAPRMProcessinvoice"
    },
    {
      "entity": "invoice",
      "field": "documentAction",
      "column": "DocAction",
      "url": "/sws/neo/purchase-invoice/invoice/{id}/action/documentAction"
    },
    {
      "entity": "invoice",
      "field": "createLinesFromOrder",
      "column": "Createfromorders",
      "url": "/sws/neo/purchase-invoice/invoice/{id}/action/createLinesFromOrder"
    },
    {
      "entity": "invoice",
      "field": "createLinesFromShipment",
      "column": "Createfrominouts",
      "url": "/sws/neo/purchase-invoice/invoice/{id}/action/createLinesFromShipment"
    },
    {
      "entity": "invoice",
      "field": "copyFrom",
      "column": "CopyFrom",
      "url": "/sws/neo/purchase-invoice/invoice/{id}/action/copyFrom"
    },
    {
      "entity": "invoice",
      "field": "eMETBLKCBulkcompletion",
      "column": "EM_Etblkc_Bulkcompletion",
      "url": "/sws/neo/purchase-invoice/invoice/{id}/action/eMETBLKCBulkcompletion"
    },
    {
      "entity": "invoice",
      "field": "posted",
      "column": "Posted",
      "url": "/sws/neo/purchase-invoice/invoice/{id}/action/posted"
    },
    {
      "entity": "invoice",
      "field": "processNow",
      "column": "Processing",
      "url": "/sws/neo/purchase-invoice/invoice/{id}/action/processNow"
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
      "example": "_sortBy=purchase-invoiceDate"
    },
    "filtering": "Use field name as query param: ?fieldName=value",
    "parentFilter": "parentId={id} for child entities"
  }
};

// @sf-generated-start component:App
export default function App({ windowName, recordId, token, apiBaseUrl, window, ...rest }) {
  // @sf-custom-slot hooks:App
  return <InvoicePage windowName={windowName} recordId={recordId} token={token} apiBaseUrl={apiBaseUrl} window={window || windowMeta} api={api} {...rest} />;
}
// @sf-generated-end component:App

// @sf-custom-slot section:App-custom

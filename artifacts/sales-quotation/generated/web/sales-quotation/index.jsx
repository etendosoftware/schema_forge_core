import QuotationPage from './QuotationPage';

const windowMeta = { category: 'sales', name: 'Sales Quotation' };

const api = {
  "specName": "sales-quotation",
  "baseUrl": "/sws/neo/sales-quotation",
  "crud": {
    "quotation": {
      "get": true,
      "getById": true,
      "post": true,
      "put": true,
      "patch": true,
      "delete": true,
      "listUrl": "/sws/neo/sales-quotation/quotation",
      "detailUrl": "/sws/neo/sales-quotation/quotation/{id}",
      "supportedFilters": [
        "documentNo",
        "orderDate",
        "businessPartner",
        "validUntil",
        "documentStatus"
      ]
    },
    "quotationLine": {
      "get": true,
      "getById": true,
      "post": true,
      "put": true,
      "patch": true,
      "delete": true,
      "listUrl": "/sws/neo/sales-quotation/quotationLine",
      "detailUrl": "/sws/neo/sales-quotation/quotationLine/{id}",
      "supportedFilters": [
        "product"
      ]
    }
  },
  "selectors": [
    {
      "entity": "quotation",
      "field": "businessPartner",
      "column": "C_BPartner_ID",
      "reference": "BusinessPartner",
      "inputMode": "search",
      "url": "/sws/neo/sales-quotation/quotation/selectors/businessPartner"
    },
    {
      "entity": "quotation",
      "field": "partnerAddress",
      "column": "C_BPartner_Location_ID",
      "reference": "BusinessPartnerLocation",
      "inputMode": "dependent",
      "url": "/sws/neo/sales-quotation/quotation/selectors/partnerAddress"
    },
    {
      "entity": "quotation",
      "field": "priceList",
      "column": "M_PriceList_ID",
      "reference": "PriceList",
      "inputMode": "search",
      "url": "/sws/neo/sales-quotation/quotation/selectors/priceList"
    },
    {
      "entity": "quotation",
      "field": "paymentMethod",
      "column": "FIN_Paymentmethod_ID",
      "reference": "Paymentmethod",
      "inputMode": "selector",
      "url": "/sws/neo/sales-quotation/quotation/selectors/paymentMethod"
    },
    {
      "entity": "quotation",
      "field": "paymentTerms",
      "column": "C_PaymentTerm_ID",
      "reference": "PaymentTerm",
      "inputMode": "search",
      "url": "/sws/neo/sales-quotation/quotation/selectors/paymentTerms"
    },
    {
      "entity": "quotation",
      "field": "currency",
      "column": "C_Currency_ID",
      "reference": "Currency",
      "inputMode": "selector",
      "url": "/sws/neo/sales-quotation/quotation/selectors/currency"
    },
    {
      "entity": "quotation",
      "field": "salesRepresentative",
      "column": "SalesRep_ID",
      "reference": "SalesRepresentative",
      "inputMode": "selector",
      "url": "/sws/neo/sales-quotation/quotation/selectors/salesRepresentative"
    },
    {
      "entity": "quotationLine",
      "field": "product",
      "column": "M_Product_ID",
      "reference": "Product",
      "inputMode": "search",
      "url": "/sws/neo/sales-quotation/quotationLine/selectors/product"
    },
    {
      "entity": "quotationLine",
      "field": "uOM",
      "column": "C_UOM_ID",
      "reference": "UOM",
      "inputMode": "search",
      "url": "/sws/neo/sales-quotation/quotationLine/selectors/uOM"
    },
    {
      "entity": "quotationLine",
      "field": "tax",
      "column": "C_Tax_ID",
      "reference": "Tax",
      "inputMode": "selector",
      "url": "/sws/neo/sales-quotation/quotationLine/selectors/tax"
    }
  ],
  "actions": [
    {
      "entity": "quotation",
      "field": "rMPickFromShipment",
      "column": "RM_PickFromShipment",
      "url": "/sws/neo/sales-quotation/quotation/{id}/action/rMPickFromShipment"
    },
    {
      "entity": "quotation",
      "field": "rMReceiveMaterials",
      "column": "RM_ReceiveMaterials",
      "url": "/sws/neo/sales-quotation/quotation/{id}/action/rMReceiveMaterials"
    },
    {
      "entity": "quotation",
      "field": "rMCreateInvoice",
      "column": "RM_CreateInvoice",
      "url": "/sws/neo/sales-quotation/quotation/{id}/action/rMCreateInvoice"
    },
    {
      "entity": "quotation",
      "field": "copyFrom",
      "column": "CopyFrom",
      "url": "/sws/neo/sales-quotation/quotation/{id}/action/copyFrom"
    },
    {
      "entity": "quotation",
      "field": "copyFromPO",
      "column": "CopyFromPO",
      "url": "/sws/neo/sales-quotation/quotation/{id}/action/copyFromPO"
    },
    {
      "entity": "quotation",
      "field": "documentAction",
      "column": "DocAction",
      "url": "/sws/neo/sales-quotation/quotation/{id}/action/documentAction"
    },
    {
      "entity": "quotation",
      "field": "createOrder",
      "column": "Convertquotation",
      "url": "/sws/neo/sales-quotation/quotation/{id}/action/createOrder"
    },
    {
      "entity": "quotation",
      "field": "calculatePromotions",
      "column": "Calculate_Promotions",
      "url": "/sws/neo/sales-quotation/quotation/{id}/action/calculatePromotions"
    },
    {
      "entity": "quotation",
      "field": "posted",
      "column": "Posted",
      "url": "/sws/neo/sales-quotation/quotation/{id}/action/posted"
    },
    {
      "entity": "quotation",
      "field": "generateTemplate",
      "column": "Generatetemplate",
      "url": "/sws/neo/sales-quotation/quotation/{id}/action/generateTemplate"
    },
    {
      "entity": "quotation",
      "field": "processNow",
      "column": "Processing",
      "url": "/sws/neo/sales-quotation/quotation/{id}/action/processNow"
    },
    {
      "entity": "quotation",
      "field": "cancelandreplace",
      "column": "Cancelandreplace",
      "url": "/sws/neo/sales-quotation/quotation/{id}/action/cancelandreplace"
    },
    {
      "entity": "quotation",
      "field": "confirmcancelandreplace",
      "column": "Confirmcancelandreplace",
      "url": "/sws/neo/sales-quotation/quotation/{id}/action/confirmcancelandreplace"
    },
    {
      "entity": "quotation",
      "field": "createPOLines",
      "column": "Create_POLines",
      "url": "/sws/neo/sales-quotation/quotation/{id}/action/createPOLines"
    },
    {
      "entity": "quotation",
      "field": "aPRMAddPayment",
      "column": "EM_APRM_AddPayment",
      "url": "/sws/neo/sales-quotation/quotation/{id}/action/aPRMAddPayment"
    },
    {
      "entity": "quotation",
      "field": "rMAddOrphanLine",
      "column": "RM_AddOrphanLine",
      "url": "/sws/neo/sales-quotation/quotation/{id}/action/rMAddOrphanLine"
    },
    {
      "entity": "quotation",
      "field": "rMPickfromreceipt",
      "column": "RM_Pickfromreceipt",
      "url": "/sws/neo/sales-quotation/quotation/{id}/action/rMPickfromreceipt"
    },
    {
      "entity": "quotationLine",
      "field": "explode",
      "column": "Explode",
      "url": "/sws/neo/sales-quotation/quotationLine/{id}/action/explode"
    },
    {
      "entity": "quotationLine",
      "field": "managePrereservation",
      "column": "Manage_Prereservation",
      "url": "/sws/neo/sales-quotation/quotationLine/{id}/action/managePrereservation"
    },
    {
      "entity": "quotationLine",
      "field": "manageReservation",
      "column": "Manage_Reservation",
      "url": "/sws/neo/sales-quotation/quotationLine/{id}/action/manageReservation"
    },
    {
      "entity": "quotationLine",
      "field": "selectOrderLine",
      "column": "Relate_Orderline",
      "url": "/sws/neo/sales-quotation/quotationLine/{id}/action/selectOrderLine"
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
      "example": "_sortBy=sales-quotationDate"
    },
    "filtering": "Use field name as query param: ?fieldName=value",
    "parentFilter": "parentId={id} for child entities"
  }
};

// @sf-generated-start component:App
export default function App({ windowName, recordId, token, apiBaseUrl, window, ...rest }) {
  // @sf-custom-slot hooks:App
  return <QuotationPage windowName={windowName} recordId={recordId} token={token} apiBaseUrl={apiBaseUrl} window={window || windowMeta} api={api} {...rest} />;
}
// @sf-generated-end component:App

// @sf-custom-slot section:App-custom

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
      "supportedFilters": []
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
    "invoiceLineTax": {
      "get": true,
      "getById": true,
      "post": true,
      "put": true,
      "patch": true,
      "delete": true,
      "listUrl": "/sws/neo/purchase-invoice/invoiceLineTax",
      "detailUrl": "/sws/neo/purchase-invoice/invoiceLineTax/{id}",
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
    "invoiceDiscount": {
      "get": true,
      "getById": true,
      "post": true,
      "put": true,
      "patch": true,
      "delete": true,
      "listUrl": "/sws/neo/purchase-invoice/invoiceDiscount",
      "detailUrl": "/sws/neo/purchase-invoice/invoiceDiscount/{id}",
      "supportedFilters": []
    },
    "finPaymentSchedule": {
      "get": true,
      "getById": true,
      "post": true,
      "put": true,
      "patch": true,
      "delete": true,
      "listUrl": "/sws/neo/purchase-invoice/finPaymentSchedule",
      "detailUrl": "/sws/neo/purchase-invoice/finPaymentSchedule/{id}",
      "supportedFilters": []
    },
    "finPaymentScheduleDetail": {
      "get": true,
      "getById": true,
      "post": true,
      "put": true,
      "patch": true,
      "delete": true,
      "listUrl": "/sws/neo/purchase-invoice/finPaymentScheduleDetail",
      "detailUrl": "/sws/neo/purchase-invoice/finPaymentScheduleDetail/{id}",
      "supportedFilters": []
    },
    "invoiceReverse": {
      "get": true,
      "getById": true,
      "post": true,
      "put": true,
      "patch": true,
      "delete": true,
      "listUrl": "/sws/neo/purchase-invoice/invoiceReverse",
      "detailUrl": "/sws/neo/purchase-invoice/invoiceReverse/{id}",
      "supportedFilters": []
    },
    "conversionRateDocument": {
      "get": true,
      "getById": true,
      "post": true,
      "put": true,
      "patch": true,
      "delete": true,
      "listUrl": "/sws/neo/purchase-invoice/conversionRateDocument",
      "detailUrl": "/sws/neo/purchase-invoice/conversionRateDocument/{id}",
      "supportedFilters": []
    },
    "factAcct": {
      "get": true,
      "getById": true,
      "post": true,
      "put": true,
      "patch": true,
      "delete": true,
      "listUrl": "/sws/neo/purchase-invoice/factAcct",
      "detailUrl": "/sws/neo/purchase-invoice/factAcct/{id}",
      "supportedFilters": []
    }
  },
  "selectors": [
    {
      "entity": "invoice",
      "field": "businessPartner",
      "column": "C_BPartner_ID",
      "reference": "BPartner",
      "inputMode": "search",
      "url": "/sws/neo/purchase-invoice/invoice/selectors/businessPartner"
    },
    {
      "entity": "invoice",
      "field": "partnerAddress",
      "column": "C_BPartner_Location_ID",
      "reference": "BPartner_Location",
      "inputMode": "dependent",
      "url": "/sws/neo/purchase-invoice/invoice/selectors/partnerAddress"
    },
    {
      "entity": "invoice",
      "field": "priceList",
      "column": "M_PriceList_ID",
      "reference": "PriceList",
      "inputMode": "selector",
      "url": "/sws/neo/purchase-invoice/invoice/selectors/priceList"
    },
    {
      "entity": "invoice",
      "field": "paymentTerms",
      "column": "C_PaymentTerm_ID",
      "reference": "PaymentTerm",
      "inputMode": "selector",
      "url": "/sws/neo/purchase-invoice/invoice/selectors/paymentTerms"
    },
    {
      "entity": "invoice",
      "field": "paymentMethod",
      "column": "FIN_Paymentmethod_ID",
      "reference": "Paymentmethod",
      "inputMode": "selector",
      "url": "/sws/neo/purchase-invoice/invoice/selectors/paymentMethod"
    },
    {
      "entity": "invoice",
      "field": "salesOrder",
      "column": "C_Order_ID",
      "reference": "Order",
      "inputMode": "search",
      "url": "/sws/neo/purchase-invoice/invoice/selectors/salesOrder"
    },
    {
      "entity": "invoice",
      "field": "currency",
      "column": "C_Currency_ID",
      "reference": "Currency",
      "inputMode": "selector",
      "url": "/sws/neo/purchase-invoice/invoice/selectors/currency"
    },
    {
      "entity": "invoice",
      "field": "project",
      "column": "C_Project_ID",
      "reference": "Project",
      "inputMode": "dependent",
      "url": "/sws/neo/purchase-invoice/invoice/selectors/project"
    },
    {
      "entity": "invoice",
      "field": "costcenter",
      "column": "C_Costcenter_ID",
      "reference": "Costcenter",
      "inputMode": "selector",
      "url": "/sws/neo/purchase-invoice/invoice/selectors/costcenter"
    },
    {
      "entity": "invoice",
      "field": "salesCampaign",
      "column": "C_Campaign_ID",
      "reference": "Campaign",
      "inputMode": "selector",
      "url": "/sws/neo/purchase-invoice/invoice/selectors/salesCampaign"
    },
    {
      "entity": "invoice",
      "field": "stDimension",
      "column": "User1_ID",
      "reference": "User1",
      "inputMode": "selector",
      "url": "/sws/neo/purchase-invoice/invoice/selectors/stDimension"
    },
    {
      "entity": "invoice",
      "field": "ndDimension",
      "column": "User2_ID",
      "reference": "User2",
      "inputMode": "selector",
      "url": "/sws/neo/purchase-invoice/invoice/selectors/ndDimension"
    },
    {
      "entity": "invoiceLine",
      "field": "product",
      "column": "M_Product_ID",
      "reference": "Product",
      "inputMode": "selector",
      "url": "/sws/neo/purchase-invoice/invoiceLine/selectors/product"
    },
    {
      "entity": "invoiceLine",
      "field": "account",
      "column": "Account_ID",
      "reference": "Glitem",
      "inputMode": "search",
      "url": "/sws/neo/purchase-invoice/invoiceLine/selectors/account"
    },
    {
      "entity": "invoiceLine",
      "field": "operativeUOM",
      "column": "C_Aum",
      "reference": "UOM",
      "inputMode": "dependent",
      "url": "/sws/neo/purchase-invoice/invoiceLine/selectors/operativeUOM"
    },
    {
      "entity": "invoiceLine",
      "field": "uOM",
      "column": "C_UOM_ID",
      "reference": "UOM",
      "inputMode": "selector",
      "url": "/sws/neo/purchase-invoice/invoiceLine/selectors/uOM"
    },
    {
      "entity": "invoiceLine",
      "field": "tax",
      "column": "C_Tax_ID",
      "reference": "Tax",
      "inputMode": "search",
      "url": "/sws/neo/purchase-invoice/invoiceLine/selectors/tax"
    },
    {
      "entity": "invoiceLine",
      "field": "salesOrderLine",
      "column": "C_OrderLine_ID",
      "reference": "OrderLine",
      "inputMode": "search",
      "url": "/sws/neo/purchase-invoice/invoiceLine/selectors/salesOrderLine"
    },
    {
      "entity": "invoiceLine",
      "field": "goodsShipmentLine",
      "column": "M_InOutLine_ID",
      "reference": "InOutLine",
      "inputMode": "search",
      "url": "/sws/neo/purchase-invoice/invoiceLine/selectors/goodsShipmentLine"
    },
    {
      "entity": "invoiceLine",
      "field": "period",
      "column": "C_Period_ID",
      "reference": "Period",
      "inputMode": "search",
      "url": "/sws/neo/purchase-invoice/invoiceLine/selectors/period"
    },
    {
      "entity": "invoiceLine",
      "field": "businessPartner",
      "column": "C_Bpartner_ID",
      "reference": "BPartner",
      "inputMode": "search",
      "url": "/sws/neo/purchase-invoice/invoiceLine/selectors/businessPartner"
    },
    {
      "entity": "invoiceLine",
      "field": "project",
      "column": "C_Project_ID",
      "reference": "Project",
      "inputMode": "search",
      "url": "/sws/neo/purchase-invoice/invoiceLine/selectors/project"
    },
    {
      "entity": "invoiceLine",
      "field": "costcenter",
      "column": "C_Costcenter_ID",
      "reference": "Costcenter",
      "inputMode": "selector",
      "url": "/sws/neo/purchase-invoice/invoiceLine/selectors/costcenter"
    },
    {
      "entity": "invoiceLine",
      "field": "asset",
      "column": "A_Asset_ID",
      "reference": "Asset",
      "inputMode": "selector",
      "url": "/sws/neo/purchase-invoice/invoiceLine/selectors/asset"
    },
    {
      "entity": "invoiceLine",
      "field": "stDimension",
      "column": "User1_ID",
      "reference": "User1",
      "inputMode": "selector",
      "url": "/sws/neo/purchase-invoice/invoiceLine/selectors/stDimension"
    },
    {
      "entity": "invoiceLine",
      "field": "ndDimension",
      "column": "User2_ID",
      "reference": "User2",
      "inputMode": "selector",
      "url": "/sws/neo/purchase-invoice/invoiceLine/selectors/ndDimension"
    },
    {
      "entity": "invoiceLineTax",
      "field": "tax",
      "column": "C_Tax_ID",
      "reference": "Tax",
      "inputMode": "selector",
      "url": "/sws/neo/purchase-invoice/invoiceLineTax/selectors/tax"
    },
    {
      "entity": "invoiceTax",
      "field": "tax",
      "column": "C_Tax_ID",
      "reference": "Tax",
      "inputMode": "selector",
      "url": "/sws/neo/purchase-invoice/invoiceTax/selectors/tax"
    },
    {
      "entity": "invoiceDiscount",
      "field": "discount",
      "column": "C_Discount_ID",
      "reference": "Discount",
      "inputMode": "selector",
      "url": "/sws/neo/purchase-invoice/invoiceDiscount/selectors/discount"
    },
    {
      "entity": "finPaymentSchedule",
      "field": "finPaymentmethodID",
      "column": "Fin_Paymentmethod_ID",
      "reference": "Paymentmethod",
      "inputMode": "selector",
      "url": "/sws/neo/purchase-invoice/finPaymentSchedule/selectors/finPaymentmethodID"
    },
    {
      "entity": "finPaymentSchedule",
      "field": "currency",
      "column": "C_Currency_ID",
      "reference": "Currency",
      "inputMode": "selector",
      "url": "/sws/neo/purchase-invoice/finPaymentSchedule/selectors/currency"
    },
    {
      "entity": "finPaymentScheduleDetail",
      "field": "paymentMethod",
      "column": "Fin_Paymentmethod_ID",
      "reference": "Paymentmethod",
      "inputMode": "selector",
      "url": "/sws/neo/purchase-invoice/finPaymentScheduleDetail/selectors/paymentMethod"
    },
    {
      "entity": "finPaymentScheduleDetail",
      "field": "account",
      "column": "Fin_Financial_Account_ID",
      "reference": "Financial_Account",
      "inputMode": "dependent",
      "url": "/sws/neo/purchase-invoice/finPaymentScheduleDetail/selectors/account"
    },
    {
      "entity": "finPaymentScheduleDetail",
      "field": "finPaymentID",
      "column": "Fin_Payment_ID",
      "reference": "Payment",
      "inputMode": "selector",
      "url": "/sws/neo/purchase-invoice/finPaymentScheduleDetail/selectors/finPaymentID"
    },
    {
      "entity": "invoiceReverse",
      "field": "reversedInvoice",
      "column": "Reversed_C_Invoice_ID",
      "reference": "Invoice",
      "inputMode": "search",
      "url": "/sws/neo/purchase-invoice/invoiceReverse/selectors/reversedInvoice"
    },
    {
      "entity": "conversionRateDocument",
      "field": "currency",
      "column": "C_Currency_ID",
      "reference": "Currency",
      "inputMode": "selector",
      "url": "/sws/neo/purchase-invoice/conversionRateDocument/selectors/currency"
    },
    {
      "entity": "conversionRateDocument",
      "field": "toCurrency",
      "column": "C_Currency_Id_To",
      "reference": "Currency",
      "inputMode": "search",
      "url": "/sws/neo/purchase-invoice/conversionRateDocument/selectors/toCurrency"
    },
    {
      "entity": "factAcct",
      "field": "accountingSchema",
      "column": "C_AcctSchema_ID",
      "reference": "AcctSchema",
      "inputMode": "selector",
      "url": "/sws/neo/purchase-invoice/factAcct/selectors/accountingSchema"
    },
    {
      "entity": "factAcct",
      "field": "currency",
      "column": "C_Currency_ID",
      "reference": "Currency",
      "inputMode": "selector",
      "url": "/sws/neo/purchase-invoice/factAcct/selectors/currency"
    },
    {
      "entity": "factAcct",
      "field": "period",
      "column": "C_Period_ID",
      "reference": "Period",
      "inputMode": "selector",
      "url": "/sws/neo/purchase-invoice/factAcct/selectors/period"
    },
    {
      "entity": "factAcct",
      "field": "account",
      "column": "Account_ID",
      "reference": "ElementValue",
      "inputMode": "search",
      "url": "/sws/neo/purchase-invoice/factAcct/selectors/account"
    },
    {
      "entity": "factAcct",
      "field": "businessPartner",
      "column": "C_BPartner_ID",
      "reference": "BPartner",
      "inputMode": "search",
      "url": "/sws/neo/purchase-invoice/factAcct/selectors/businessPartner"
    },
    {
      "entity": "factAcct",
      "field": "product",
      "column": "M_Product_ID",
      "reference": "Product",
      "inputMode": "search",
      "url": "/sws/neo/purchase-invoice/factAcct/selectors/product"
    },
    {
      "entity": "factAcct",
      "field": "project",
      "column": "C_Project_ID",
      "reference": "Project",
      "inputMode": "selector",
      "url": "/sws/neo/purchase-invoice/factAcct/selectors/project"
    },
    {
      "entity": "factAcct",
      "field": "costcenter",
      "column": "C_Costcenter_ID",
      "reference": "Costcenter",
      "inputMode": "selector",
      "url": "/sws/neo/purchase-invoice/factAcct/selectors/costcenter"
    },
    {
      "entity": "factAcct",
      "field": "asset",
      "column": "A_Asset_ID",
      "reference": "Asset",
      "inputMode": "selector",
      "url": "/sws/neo/purchase-invoice/factAcct/selectors/asset"
    },
    {
      "entity": "factAcct",
      "field": "stDimension",
      "column": "User1_ID",
      "reference": "User1",
      "inputMode": "selector",
      "url": "/sws/neo/purchase-invoice/factAcct/selectors/stDimension"
    },
    {
      "entity": "factAcct",
      "field": "ndDimension",
      "column": "User2_ID",
      "reference": "User2",
      "inputMode": "selector",
      "url": "/sws/neo/purchase-invoice/factAcct/selectors/ndDimension"
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
      "field": "aPRMAddpayment",
      "column": "EM_APRM_Addpayment",
      "url": "/sws/neo/purchase-invoice/invoice/{id}/action/aPRMAddpayment"
    },
    {
      "entity": "invoice",
      "field": "posted",
      "column": "Posted",
      "url": "/sws/neo/purchase-invoice/invoice/{id}/action/posted"
    },
    {
      "entity": "invoice",
      "field": "aPRMProcessinvoice",
      "column": "EM_APRM_Processinvoice",
      "url": "/sws/neo/purchase-invoice/invoice/{id}/action/aPRMProcessinvoice"
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
      "field": "calculatePromotions",
      "column": "Calculate_Promotions",
      "url": "/sws/neo/purchase-invoice/invoice/{id}/action/calculatePromotions"
    },
    {
      "entity": "invoice",
      "field": "processNow",
      "column": "Processing",
      "url": "/sws/neo/purchase-invoice/invoice/{id}/action/processNow"
    },
    {
      "entity": "invoice",
      "field": "createLinesFrom",
      "column": "CreateFrom",
      "url": "/sws/neo/purchase-invoice/invoice/{id}/action/createLinesFrom"
    },
    {
      "entity": "invoiceLine",
      "field": "explode",
      "column": "Explode",
      "url": "/sws/neo/purchase-invoice/invoiceLine/{id}/action/explode"
    },
    {
      "entity": "invoiceLine",
      "field": "matchLCCosts",
      "column": "Match_Lccosts",
      "url": "/sws/neo/purchase-invoice/invoiceLine/{id}/action/matchLCCosts"
    },
    {
      "entity": "finPaymentSchedule",
      "field": "updatePaymentPlan",
      "column": "Update_Payment_Plan",
      "url": "/sws/neo/purchase-invoice/finPaymentSchedule/{id}/action/updatePaymentPlan"
    },
    {
      "entity": "finPaymentSchedule",
      "field": "aprmModifPaymentOUTPlan",
      "column": "EM_Aprm_Modif_Paym_Out_Sched",
      "url": "/sws/neo/purchase-invoice/finPaymentSchedule/{id}/action/aprmModifPaymentOUTPlan"
    },
    {
      "entity": "finPaymentSchedule",
      "field": "aprmModifPaymentINPlan",
      "column": "EM_Aprm_Modif_Paym_Sched",
      "url": "/sws/neo/purchase-invoice/finPaymentSchedule/{id}/action/aprmModifPaymentINPlan"
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

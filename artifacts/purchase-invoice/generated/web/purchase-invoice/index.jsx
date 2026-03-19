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
      "field": "cBpartnerId",
      "column": "C_BPartner_ID",
      "reference": "BPartner",
      "inputMode": "search",
      "url": "/sws/neo/purchase-invoice/invoice/selectors/cBpartnerId"
    },
    {
      "entity": "invoice",
      "field": "cBpartnerLocationId",
      "column": "C_BPartner_Location_ID",
      "reference": "BPartner_Location",
      "inputMode": "selector",
      "url": "/sws/neo/purchase-invoice/invoice/selectors/cBpartnerLocationId"
    },
    {
      "entity": "invoice",
      "field": "mPriceListId",
      "column": "M_PriceList_ID",
      "reference": "PriceList",
      "inputMode": "selector",
      "url": "/sws/neo/purchase-invoice/invoice/selectors/mPriceListId"
    },
    {
      "entity": "invoice",
      "field": "cPaymentTermId",
      "column": "C_PaymentTerm_ID",
      "reference": "PaymentTerm",
      "inputMode": "selector",
      "url": "/sws/neo/purchase-invoice/invoice/selectors/cPaymentTermId"
    },
    {
      "entity": "invoice",
      "field": "finPaymentmethodId",
      "column": "FIN_Paymentmethod_ID",
      "reference": "Paymentmethod",
      "inputMode": "selector",
      "url": "/sws/neo/purchase-invoice/invoice/selectors/finPaymentmethodId"
    },
    {
      "entity": "invoice",
      "field": "cOrderId",
      "column": "C_Order_ID",
      "reference": "Order",
      "inputMode": "search",
      "url": "/sws/neo/purchase-invoice/invoice/selectors/cOrderId"
    },
    {
      "entity": "invoice",
      "field": "cProjectId",
      "column": "C_Project_ID",
      "reference": "Project",
      "inputMode": "search",
      "url": "/sws/neo/purchase-invoice/invoice/selectors/cProjectId"
    },
    {
      "entity": "invoice",
      "field": "cCostcenterId",
      "column": "C_Costcenter_ID",
      "reference": "Costcenter",
      "inputMode": "selector",
      "url": "/sws/neo/purchase-invoice/invoice/selectors/cCostcenterId"
    },
    {
      "entity": "invoice",
      "field": "cCampaignId",
      "column": "C_Campaign_ID",
      "reference": "Campaign",
      "inputMode": "selector",
      "url": "/sws/neo/purchase-invoice/invoice/selectors/cCampaignId"
    },
    {
      "entity": "invoice",
      "field": "user1Id",
      "column": "User1_ID",
      "reference": "User1",
      "inputMode": "selector",
      "url": "/sws/neo/purchase-invoice/invoice/selectors/user1Id"
    },
    {
      "entity": "invoice",
      "field": "user2Id",
      "column": "User2_ID",
      "reference": "User2",
      "inputMode": "selector",
      "url": "/sws/neo/purchase-invoice/invoice/selectors/user2Id"
    },
    {
      "entity": "invoiceLine",
      "field": "mProductId",
      "column": "M_Product_ID",
      "reference": "Product",
      "inputMode": "selector",
      "url": "/sws/neo/purchase-invoice/invoiceLine/selectors/mProductId"
    },
    {
      "entity": "invoiceLine",
      "field": "accountId",
      "column": "Account_ID",
      "reference": "Glitem",
      "inputMode": "search",
      "url": "/sws/neo/purchase-invoice/invoiceLine/selectors/accountId"
    },
    {
      "entity": "invoiceLine",
      "field": "cAum",
      "column": "C_Aum",
      "reference": "UOM",
      "inputMode": "search",
      "url": "/sws/neo/purchase-invoice/invoiceLine/selectors/cAum"
    },
    {
      "entity": "invoiceLine",
      "field": "cUomId",
      "column": "C_UOM_ID",
      "reference": "UOM",
      "inputMode": "selector",
      "url": "/sws/neo/purchase-invoice/invoiceLine/selectors/cUomId"
    },
    {
      "entity": "invoiceLine",
      "field": "cTaxId",
      "column": "C_Tax_ID",
      "reference": "Tax",
      "inputMode": "search",
      "url": "/sws/neo/purchase-invoice/invoiceLine/selectors/cTaxId"
    },
    {
      "entity": "invoiceLine",
      "field": "cOrderLineId",
      "column": "C_OrderLine_ID",
      "reference": "OrderLine",
      "inputMode": "search",
      "url": "/sws/neo/purchase-invoice/invoiceLine/selectors/cOrderLineId"
    },
    {
      "entity": "invoiceLine",
      "field": "mInOutLineId",
      "column": "M_InOutLine_ID",
      "reference": "InOutLine",
      "inputMode": "search",
      "url": "/sws/neo/purchase-invoice/invoiceLine/selectors/mInOutLineId"
    },
    {
      "entity": "invoiceLine",
      "field": "cPeriodId",
      "column": "C_Period_ID",
      "reference": "Period",
      "inputMode": "search",
      "url": "/sws/neo/purchase-invoice/invoiceLine/selectors/cPeriodId"
    },
    {
      "entity": "invoiceLine",
      "field": "cBpartnerId",
      "column": "C_Bpartner_ID",
      "reference": "BPartner",
      "inputMode": "search",
      "url": "/sws/neo/purchase-invoice/invoiceLine/selectors/cBpartnerId"
    },
    {
      "entity": "invoiceLine",
      "field": "cProjectId",
      "column": "C_Project_ID",
      "reference": "Project",
      "inputMode": "search",
      "url": "/sws/neo/purchase-invoice/invoiceLine/selectors/cProjectId"
    },
    {
      "entity": "invoiceLine",
      "field": "cCostcenterId",
      "column": "C_Costcenter_ID",
      "reference": "Costcenter",
      "inputMode": "selector",
      "url": "/sws/neo/purchase-invoice/invoiceLine/selectors/cCostcenterId"
    },
    {
      "entity": "invoiceLine",
      "field": "aAssetId",
      "column": "A_Asset_ID",
      "reference": "Asset",
      "inputMode": "selector",
      "url": "/sws/neo/purchase-invoice/invoiceLine/selectors/aAssetId"
    },
    {
      "entity": "invoiceLine",
      "field": "user1Id",
      "column": "User1_ID",
      "reference": "User1",
      "inputMode": "selector",
      "url": "/sws/neo/purchase-invoice/invoiceLine/selectors/user1Id"
    },
    {
      "entity": "invoiceLine",
      "field": "user2Id",
      "column": "User2_ID",
      "reference": "User2",
      "inputMode": "selector",
      "url": "/sws/neo/purchase-invoice/invoiceLine/selectors/user2Id"
    },
    {
      "entity": "invoiceLineTax",
      "field": "cTaxId",
      "column": "C_Tax_ID",
      "reference": "Tax",
      "inputMode": "selector",
      "url": "/sws/neo/purchase-invoice/invoiceLineTax/selectors/cTaxId"
    },
    {
      "entity": "invoiceTax",
      "field": "cTaxId",
      "column": "C_Tax_ID",
      "reference": "Tax",
      "inputMode": "selector",
      "url": "/sws/neo/purchase-invoice/invoiceTax/selectors/cTaxId"
    },
    {
      "entity": "invoiceDiscount",
      "field": "cDiscountId",
      "column": "C_Discount_ID",
      "reference": "Discount",
      "inputMode": "selector",
      "url": "/sws/neo/purchase-invoice/invoiceDiscount/selectors/cDiscountId"
    },
    {
      "entity": "finPaymentSchedule",
      "field": "finPaymentmethodId",
      "column": "Fin_Paymentmethod_ID",
      "reference": "Paymentmethod",
      "inputMode": "selector",
      "url": "/sws/neo/purchase-invoice/finPaymentSchedule/selectors/finPaymentmethodId"
    },
    {
      "entity": "finPaymentSchedule",
      "field": "cCurrencyId",
      "column": "C_Currency_ID",
      "reference": "Currency",
      "inputMode": "selector",
      "url": "/sws/neo/purchase-invoice/finPaymentSchedule/selectors/cCurrencyId"
    },
    {
      "entity": "finPaymentScheduleDetail",
      "field": "finPaymentmethodId",
      "column": "Fin_Paymentmethod_ID",
      "reference": "Paymentmethod",
      "inputMode": "selector",
      "url": "/sws/neo/purchase-invoice/finPaymentScheduleDetail/selectors/finPaymentmethodId"
    },
    {
      "entity": "finPaymentScheduleDetail",
      "field": "finFinancialAccountId",
      "column": "Fin_Financial_Account_ID",
      "reference": "Financial_Account",
      "inputMode": "selector",
      "url": "/sws/neo/purchase-invoice/finPaymentScheduleDetail/selectors/finFinancialAccountId"
    },
    {
      "entity": "finPaymentScheduleDetail",
      "field": "finPaymentId",
      "column": "Fin_Payment_ID",
      "reference": "Payment",
      "inputMode": "selector",
      "url": "/sws/neo/purchase-invoice/finPaymentScheduleDetail/selectors/finPaymentId"
    },
    {
      "entity": "invoiceReverse",
      "field": "reversedCInvoiceId",
      "column": "Reversed_C_Invoice_ID",
      "reference": "Invoice",
      "inputMode": "search",
      "url": "/sws/neo/purchase-invoice/invoiceReverse/selectors/reversedCInvoiceId"
    },
    {
      "entity": "conversionRateDocument",
      "field": "cCurrencyId",
      "column": "C_Currency_ID",
      "reference": "Currency",
      "inputMode": "selector",
      "url": "/sws/neo/purchase-invoice/conversionRateDocument/selectors/cCurrencyId"
    },
    {
      "entity": "conversionRateDocument",
      "field": "cCurrencyIdTo",
      "column": "C_Currency_Id_To",
      "reference": "Currency",
      "inputMode": "search",
      "url": "/sws/neo/purchase-invoice/conversionRateDocument/selectors/cCurrencyIdTo"
    },
    {
      "entity": "factAcct",
      "field": "cAcctSchemaId",
      "column": "C_AcctSchema_ID",
      "reference": "AcctSchema",
      "inputMode": "selector",
      "url": "/sws/neo/purchase-invoice/factAcct/selectors/cAcctSchemaId"
    },
    {
      "entity": "factAcct",
      "field": "cCurrencyId",
      "column": "C_Currency_ID",
      "reference": "Currency",
      "inputMode": "selector",
      "url": "/sws/neo/purchase-invoice/factAcct/selectors/cCurrencyId"
    },
    {
      "entity": "factAcct",
      "field": "cPeriodId",
      "column": "C_Period_ID",
      "reference": "Period",
      "inputMode": "selector",
      "url": "/sws/neo/purchase-invoice/factAcct/selectors/cPeriodId"
    },
    {
      "entity": "factAcct",
      "field": "accountId",
      "column": "Account_ID",
      "reference": "ElementValue",
      "inputMode": "search",
      "url": "/sws/neo/purchase-invoice/factAcct/selectors/accountId"
    },
    {
      "entity": "factAcct",
      "field": "cBpartnerId",
      "column": "C_BPartner_ID",
      "reference": "BPartner",
      "inputMode": "search",
      "url": "/sws/neo/purchase-invoice/factAcct/selectors/cBpartnerId"
    },
    {
      "entity": "factAcct",
      "field": "mProductId",
      "column": "M_Product_ID",
      "reference": "Product",
      "inputMode": "search",
      "url": "/sws/neo/purchase-invoice/factAcct/selectors/mProductId"
    },
    {
      "entity": "factAcct",
      "field": "cProjectId",
      "column": "C_Project_ID",
      "reference": "Project",
      "inputMode": "selector",
      "url": "/sws/neo/purchase-invoice/factAcct/selectors/cProjectId"
    },
    {
      "entity": "factAcct",
      "field": "cCostcenterId",
      "column": "C_Costcenter_ID",
      "reference": "Costcenter",
      "inputMode": "selector",
      "url": "/sws/neo/purchase-invoice/factAcct/selectors/cCostcenterId"
    },
    {
      "entity": "factAcct",
      "field": "aAssetId",
      "column": "A_Asset_ID",
      "reference": "Asset",
      "inputMode": "selector",
      "url": "/sws/neo/purchase-invoice/factAcct/selectors/aAssetId"
    },
    {
      "entity": "factAcct",
      "field": "user1Id",
      "column": "User1_ID",
      "reference": "User1",
      "inputMode": "selector",
      "url": "/sws/neo/purchase-invoice/factAcct/selectors/user1Id"
    },
    {
      "entity": "factAcct",
      "field": "user2Id",
      "column": "User2_ID",
      "reference": "User2",
      "inputMode": "selector",
      "url": "/sws/neo/purchase-invoice/factAcct/selectors/user2Id"
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

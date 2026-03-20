import HeaderPage from './HeaderPage';

const windowMeta = { category: 'general', name: 'Payment In' };

const api = {
  "specName": "payment-in",
  "baseUrl": "/sws/neo/payment-in",
  "crud": {
    "header": {
      "get": true,
      "getById": true,
      "post": true,
      "put": true,
      "patch": true,
      "delete": true,
      "listUrl": "/sws/neo/payment-in/header",
      "detailUrl": "/sws/neo/payment-in/header/{id}",
      "supportedFilters": [
        "referenceNo",
        "paymentDate",
        "businessPartner",
        "description",
        "paymentMethod",
        "amount",
        "account",
        "currency",
        "financialTransactionAmount",
        "financialTransactionConvertRate",
        "aPRMAddScheduledpayments",
        "aPRMProcessPayment",
        "aprmExecutepayment",
        "reversedPayment",
        "project",
        "costCenter",
        "stDimension",
        "ndDimension"
      ]
    },
    "lines": {
      "get": true,
      "getById": true,
      "post": true,
      "put": true,
      "patch": true,
      "delete": true,
      "listUrl": "/sws/neo/payment-in/lines",
      "detailUrl": "/sws/neo/payment-in/lines/{id}",
      "supportedFilters": [
        "amount",
        "orderPaymentSchedule",
        "invoicePaymentSchedule",
        "gLItem",
        "canceled",
        "businessPartner",
        "activity",
        "product",
        "salesCampaign",
        "project",
        "salesRegion",
        "costCenter",
        "stDimension",
        "ndDimension"
      ]
    }
  },
  "selectors": [
    {
      "entity": "header",
      "field": "businessPartner",
      "column": "C_Bpartner_ID",
      "inputMode": "search",
      "url": "/sws/neo/payment-in/header/selectors/businessPartner"
    },
    {
      "entity": "header",
      "field": "paymentMethod",
      "column": "Fin_Paymentmethod_ID",
      "inputMode": "search",
      "url": "/sws/neo/payment-in/header/selectors/paymentMethod"
    },
    {
      "entity": "header",
      "field": "account",
      "column": "Fin_Financial_Account_ID",
      "inputMode": "dependent",
      "url": "/sws/neo/payment-in/header/selectors/account"
    },
    {
      "entity": "header",
      "field": "currency",
      "column": "C_Currency_ID",
      "inputMode": "dependent",
      "url": "/sws/neo/payment-in/header/selectors/currency"
    },
    {
      "entity": "header",
      "field": "reversedPayment",
      "column": "FIN_Rev_Payment_ID",
      "reference": "Payment Selector",
      "inputMode": "search",
      "url": "/sws/neo/payment-in/header/selectors/reversedPayment"
    },
    {
      "entity": "header",
      "field": "project",
      "column": "C_Project_ID",
      "inputMode": "search",
      "url": "/sws/neo/payment-in/header/selectors/project"
    },
    {
      "entity": "header",
      "field": "costCenter",
      "column": "C_Costcenter_ID",
      "reference": "Cost Center Selector",
      "inputMode": "search",
      "url": "/sws/neo/payment-in/header/selectors/costCenter"
    },
    {
      "entity": "header",
      "field": "stDimension",
      "column": "User1_ID",
      "reference": "User Dimension 1",
      "inputMode": "search",
      "url": "/sws/neo/payment-in/header/selectors/stDimension"
    },
    {
      "entity": "header",
      "field": "ndDimension",
      "column": "User2_ID",
      "reference": "User Dimension 2",
      "inputMode": "search",
      "url": "/sws/neo/payment-in/header/selectors/ndDimension"
    },
    {
      "entity": "lines",
      "field": "orderPaymentSchedule",
      "column": "FIN_Payment_Schedule_Order",
      "inputMode": "search",
      "url": "/sws/neo/payment-in/lines/selectors/orderPaymentSchedule"
    },
    {
      "entity": "lines",
      "field": "invoicePaymentSchedule",
      "column": "FIN_Payment_Schedule_Invoice",
      "inputMode": "search",
      "url": "/sws/neo/payment-in/lines/selectors/invoicePaymentSchedule"
    },
    {
      "entity": "lines",
      "field": "gLItem",
      "column": "C_Glitem_ID",
      "inputMode": "search",
      "url": "/sws/neo/payment-in/lines/selectors/gLItem"
    },
    {
      "entity": "lines",
      "field": "businessPartner",
      "column": "C_Bpartner_ID",
      "inputMode": "search",
      "url": "/sws/neo/payment-in/lines/selectors/businessPartner"
    },
    {
      "entity": "lines",
      "field": "activity",
      "column": "C_Activity_ID",
      "reference": "Activity selector",
      "inputMode": "search",
      "url": "/sws/neo/payment-in/lines/selectors/activity"
    },
    {
      "entity": "lines",
      "field": "product",
      "column": "M_Product_ID",
      "inputMode": "search",
      "url": "/sws/neo/payment-in/lines/selectors/product"
    },
    {
      "entity": "lines",
      "field": "salesCampaign",
      "column": "C_Campaign_ID",
      "reference": "Campaign selector",
      "inputMode": "search",
      "url": "/sws/neo/payment-in/lines/selectors/salesCampaign"
    },
    {
      "entity": "lines",
      "field": "project",
      "column": "C_Project_ID",
      "inputMode": "search",
      "url": "/sws/neo/payment-in/lines/selectors/project"
    },
    {
      "entity": "lines",
      "field": "salesRegion",
      "column": "C_Salesregion_ID",
      "reference": "Sales region selector",
      "inputMode": "search",
      "url": "/sws/neo/payment-in/lines/selectors/salesRegion"
    },
    {
      "entity": "lines",
      "field": "costCenter",
      "column": "C_Costcenter_ID",
      "reference": "Cost Center Selector",
      "inputMode": "search",
      "url": "/sws/neo/payment-in/lines/selectors/costCenter"
    },
    {
      "entity": "lines",
      "field": "stDimension",
      "column": "User1_ID",
      "reference": "User Dimension 1",
      "inputMode": "search",
      "url": "/sws/neo/payment-in/lines/selectors/stDimension"
    },
    {
      "entity": "lines",
      "field": "ndDimension",
      "column": "User2_ID",
      "reference": "User Dimension 2",
      "inputMode": "search",
      "url": "/sws/neo/payment-in/lines/selectors/ndDimension"
    }
  ],
  "actions": [
    {
      "entity": "header",
      "field": "aPRMAddScheduledpayments",
      "column": "EM_Aprm_Add_Scheduledpayments",
      "url": "/sws/neo/payment-in/header/{id}/action/aPRMAddScheduledpayments"
    },
    {
      "entity": "header",
      "field": "posted",
      "column": "Posted",
      "url": "/sws/neo/payment-in/header/{id}/action/posted"
    },
    {
      "entity": "header",
      "field": "aPRMProcessPayment",
      "column": "EM_APRM_Process_Payment",
      "url": "/sws/neo/payment-in/header/{id}/action/aPRMProcessPayment"
    },
    {
      "entity": "header",
      "field": "aprmExecutepayment",
      "column": "EM_Aprm_Executepayment",
      "url": "/sws/neo/payment-in/header/{id}/action/aprmExecutepayment"
    },
    {
      "entity": "header",
      "field": "aPRMReversePayment",
      "column": "EM_APRM_ReversePayment",
      "url": "/sws/neo/payment-in/header/{id}/action/aPRMReversePayment"
    },
    {
      "entity": "header",
      "field": "aPRMReconcilePayment",
      "column": "EM_APRM_Reconcile_Payment",
      "url": "/sws/neo/payment-in/header/{id}/action/aPRMReconcilePayment"
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
      "example": "_sortBy=payment-inDate"
    },
    "filtering": "Use field name as query param: ?fieldName=value",
    "parentFilter": "parentId={id} for child entities"
  }
};

// @sf-generated-start component:App
export default function App({ windowName, recordId, token, apiBaseUrl, window, ...rest }) {
  // @sf-custom-slot hooks:App
  return <HeaderPage windowName={windowName} recordId={recordId} token={token} apiBaseUrl={apiBaseUrl} window={window || windowMeta} api={api} {...rest} />;
}
// @sf-generated-end component:App

// @sf-custom-slot section:App-custom

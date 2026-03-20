import FinPaymentPage from './FinPaymentPage';

const windowMeta = { category: 'general', name: 'Payment In' };

const api = {
  "specName": "payment-in",
  "baseUrl": "/sws/neo/payment-in",
  "crud": {
    "finPayment": {
      "get": true,
      "getById": true,
      "post": true,
      "put": true,
      "patch": true,
      "delete": true,
      "listUrl": "/sws/neo/payment-in/finPayment",
      "detailUrl": "/sws/neo/payment-in/finPayment/{id}",
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
    "finPaymentScheduleDetail": {
      "get": true,
      "getById": true,
      "post": true,
      "put": true,
      "patch": true,
      "delete": true,
      "listUrl": "/sws/neo/payment-in/finPaymentScheduleDetail",
      "detailUrl": "/sws/neo/payment-in/finPaymentScheduleDetail/{id}",
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
      "entity": "finPayment",
      "field": "businessPartner",
      "column": "C_Bpartner_ID",
      "inputMode": "search",
      "url": "/sws/neo/payment-in/finPayment/selectors/businessPartner"
    },
    {
      "entity": "finPayment",
      "field": "paymentMethod",
      "column": "Fin_Paymentmethod_ID",
      "inputMode": "search",
      "url": "/sws/neo/payment-in/finPayment/selectors/paymentMethod"
    },
    {
      "entity": "finPayment",
      "field": "account",
      "column": "Fin_Financial_Account_ID",
      "inputMode": "dependent",
      "url": "/sws/neo/payment-in/finPayment/selectors/account"
    },
    {
      "entity": "finPayment",
      "field": "currency",
      "column": "C_Currency_ID",
      "inputMode": "dependent",
      "url": "/sws/neo/payment-in/finPayment/selectors/currency"
    },
    {
      "entity": "finPayment",
      "field": "reversedPayment",
      "column": "FIN_Rev_Payment_ID",
      "reference": "Payment Selector",
      "inputMode": "search",
      "url": "/sws/neo/payment-in/finPayment/selectors/reversedPayment"
    },
    {
      "entity": "finPayment",
      "field": "project",
      "column": "C_Project_ID",
      "inputMode": "search",
      "url": "/sws/neo/payment-in/finPayment/selectors/project"
    },
    {
      "entity": "finPayment",
      "field": "costCenter",
      "column": "C_Costcenter_ID",
      "reference": "Cost Center Selector",
      "inputMode": "search",
      "url": "/sws/neo/payment-in/finPayment/selectors/costCenter"
    },
    {
      "entity": "finPayment",
      "field": "stDimension",
      "column": "User1_ID",
      "reference": "User Dimension 1",
      "inputMode": "search",
      "url": "/sws/neo/payment-in/finPayment/selectors/stDimension"
    },
    {
      "entity": "finPayment",
      "field": "ndDimension",
      "column": "User2_ID",
      "reference": "User Dimension 2",
      "inputMode": "search",
      "url": "/sws/neo/payment-in/finPayment/selectors/ndDimension"
    },
    {
      "entity": "finPaymentScheduleDetail",
      "field": "orderPaymentSchedule",
      "column": "FIN_Payment_Schedule_Order",
      "inputMode": "search",
      "url": "/sws/neo/payment-in/finPaymentScheduleDetail/selectors/orderPaymentSchedule"
    },
    {
      "entity": "finPaymentScheduleDetail",
      "field": "invoicePaymentSchedule",
      "column": "FIN_Payment_Schedule_Invoice",
      "inputMode": "search",
      "url": "/sws/neo/payment-in/finPaymentScheduleDetail/selectors/invoicePaymentSchedule"
    },
    {
      "entity": "finPaymentScheduleDetail",
      "field": "gLItem",
      "column": "C_Glitem_ID",
      "inputMode": "search",
      "url": "/sws/neo/payment-in/finPaymentScheduleDetail/selectors/gLItem"
    },
    {
      "entity": "finPaymentScheduleDetail",
      "field": "businessPartner",
      "column": "C_Bpartner_ID",
      "inputMode": "search",
      "url": "/sws/neo/payment-in/finPaymentScheduleDetail/selectors/businessPartner"
    },
    {
      "entity": "finPaymentScheduleDetail",
      "field": "activity",
      "column": "C_Activity_ID",
      "reference": "Activity selector",
      "inputMode": "search",
      "url": "/sws/neo/payment-in/finPaymentScheduleDetail/selectors/activity"
    },
    {
      "entity": "finPaymentScheduleDetail",
      "field": "product",
      "column": "M_Product_ID",
      "inputMode": "search",
      "url": "/sws/neo/payment-in/finPaymentScheduleDetail/selectors/product"
    },
    {
      "entity": "finPaymentScheduleDetail",
      "field": "salesCampaign",
      "column": "C_Campaign_ID",
      "reference": "Campaign selector",
      "inputMode": "search",
      "url": "/sws/neo/payment-in/finPaymentScheduleDetail/selectors/salesCampaign"
    },
    {
      "entity": "finPaymentScheduleDetail",
      "field": "project",
      "column": "C_Project_ID",
      "inputMode": "search",
      "url": "/sws/neo/payment-in/finPaymentScheduleDetail/selectors/project"
    },
    {
      "entity": "finPaymentScheduleDetail",
      "field": "salesRegion",
      "column": "C_Salesregion_ID",
      "reference": "Sales region selector",
      "inputMode": "search",
      "url": "/sws/neo/payment-in/finPaymentScheduleDetail/selectors/salesRegion"
    },
    {
      "entity": "finPaymentScheduleDetail",
      "field": "costCenter",
      "column": "C_Costcenter_ID",
      "reference": "Cost Center Selector",
      "inputMode": "search",
      "url": "/sws/neo/payment-in/finPaymentScheduleDetail/selectors/costCenter"
    },
    {
      "entity": "finPaymentScheduleDetail",
      "field": "stDimension",
      "column": "User1_ID",
      "reference": "User Dimension 1",
      "inputMode": "search",
      "url": "/sws/neo/payment-in/finPaymentScheduleDetail/selectors/stDimension"
    },
    {
      "entity": "finPaymentScheduleDetail",
      "field": "ndDimension",
      "column": "User2_ID",
      "reference": "User Dimension 2",
      "inputMode": "search",
      "url": "/sws/neo/payment-in/finPaymentScheduleDetail/selectors/ndDimension"
    }
  ],
  "actions": [
    {
      "entity": "finPayment",
      "field": "aPRMAddScheduledpayments",
      "column": "EM_Aprm_Add_Scheduledpayments",
      "url": "/sws/neo/payment-in/finPayment/{id}/action/aPRMAddScheduledpayments"
    },
    {
      "entity": "finPayment",
      "field": "posted",
      "column": "Posted",
      "url": "/sws/neo/payment-in/finPayment/{id}/action/posted"
    },
    {
      "entity": "finPayment",
      "field": "aPRMProcessPayment",
      "column": "EM_APRM_Process_Payment",
      "url": "/sws/neo/payment-in/finPayment/{id}/action/aPRMProcessPayment"
    },
    {
      "entity": "finPayment",
      "field": "aprmExecutepayment",
      "column": "EM_Aprm_Executepayment",
      "url": "/sws/neo/payment-in/finPayment/{id}/action/aprmExecutepayment"
    },
    {
      "entity": "finPayment",
      "field": "aPRMReversePayment",
      "column": "EM_APRM_ReversePayment",
      "url": "/sws/neo/payment-in/finPayment/{id}/action/aPRMReversePayment"
    },
    {
      "entity": "finPayment",
      "field": "aPRMReconcilePayment",
      "column": "EM_APRM_Reconcile_Payment",
      "url": "/sws/neo/payment-in/finPayment/{id}/action/aPRMReconcilePayment"
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
  return <FinPaymentPage windowName={windowName} recordId={recordId} token={token} apiBaseUrl={apiBaseUrl} window={window || windowMeta} api={api} {...rest} />;
}
// @sf-generated-end component:App

// @sf-custom-slot section:App-custom

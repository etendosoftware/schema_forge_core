import PaymentInPage from './PaymentInPage';

const windowMeta = { category: 'accounting', name: 'Payment In' };

const api = {
  "specName": "payment-in",
  "baseUrl": "/sws/neo/payment-in",
  "crud": {
    "paymentIn": {
      "get": true,
      "getById": true,
      "post": true,
      "put": true,
      "patch": true,
      "delete": true,
      "listUrl": "/sws/neo/payment-in/paymentIn",
      "detailUrl": "/sws/neo/payment-in/paymentIn/{id}",
      "supportedFilters": [
        "referenceNo",
        "paymentDate",
        "businessPartner",
        "account",
        "status"
      ]
    },
    "paymentLines": {
      "get": true,
      "getById": true,
      "post": true,
      "put": true,
      "patch": true,
      "delete": true,
      "listUrl": "/sws/neo/payment-in/paymentLines",
      "detailUrl": "/sws/neo/payment-in/paymentLines/{id}",
      "supportedFilters": []
    }
  },
  "selectors": [
    {
      "entity": "paymentIn",
      "field": "businessPartner",
      "column": "C_Bpartner_ID",
      "reference": "BusinessPartner",
      "url": "/sws/neo/payment-in/paymentIn/selectors/businessPartner"
    },
    {
      "entity": "paymentIn",
      "field": "paymentMethod",
      "column": "Fin_Paymentmethod_ID",
      "reference": "PaymentMethod",
      "url": "/sws/neo/payment-in/paymentIn/selectors/paymentMethod"
    },
    {
      "entity": "paymentIn",
      "field": "account",
      "column": "Fin_Financial_Account_ID",
      "reference": "FinancialAccount",
      "url": "/sws/neo/payment-in/paymentIn/selectors/account"
    },
    {
      "entity": "paymentIn",
      "field": "currency",
      "column": "C_Currency_ID",
      "reference": "Currency",
      "url": "/sws/neo/payment-in/paymentIn/selectors/currency"
    },
    {
      "entity": "paymentIn",
      "field": "reversedPayment",
      "column": "FIN_Rev_Payment_ID",
      "reference": "Payment",
      "url": "/sws/neo/payment-in/paymentIn/selectors/reversedPayment"
    },
    {
      "entity": "paymentIn",
      "field": "project",
      "column": "C_Project_ID",
      "reference": "Project",
      "url": "/sws/neo/payment-in/paymentIn/selectors/project"
    },
    {
      "entity": "paymentLines",
      "field": "invoicePaymentSchedule",
      "column": "FIN_Payment_Schedule_Invoice",
      "reference": "Invoice",
      "url": "/sws/neo/payment-in/paymentLines/selectors/invoicePaymentSchedule"
    },
    {
      "entity": "paymentLines",
      "field": "orderPaymentSchedule",
      "column": "FIN_Payment_Schedule_Order",
      "reference": "SalesOrder",
      "url": "/sws/neo/payment-in/paymentLines/selectors/orderPaymentSchedule"
    },
    {
      "entity": "paymentLines",
      "field": "gLItem",
      "column": "C_Glitem_ID",
      "reference": "GLItem",
      "url": "/sws/neo/payment-in/paymentLines/selectors/gLItem"
    },
    {
      "entity": "paymentLines",
      "field": "businessPartner",
      "column": "C_Bpartner_ID",
      "reference": "BusinessPartner",
      "url": "/sws/neo/payment-in/paymentLines/selectors/businessPartner"
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
      "example": "_sortBy=payment-inDate"
    },
    "filtering": "Use field name as query param: ?fieldName=value",
    "parentFilter": "parentId={id} for child entities"
  }
};

// @sf-generated-start component:App
export default function App({ windowName, recordId, token, apiBaseUrl, window, ...rest }) {
  // @sf-custom-slot hooks:App
  return <PaymentInPage windowName={windowName} recordId={recordId} token={token} apiBaseUrl={apiBaseUrl} window={window || windowMeta} api={api} {...rest} />;
}
// @sf-generated-end component:App

// @sf-custom-slot section:App-custom

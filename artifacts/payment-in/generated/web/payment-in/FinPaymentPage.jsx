import { ListView, DetailView } from '@/components/contract-ui';
import FinPaymentTable from './FinPaymentTable';
import FinPaymentForm from './FinPaymentForm';
import FinPaymentScheduleDetailTable from './FinPaymentScheduleDetailTable';
import catalogs from './mockCatalogs';

const breadcrumb = 'General / Payment In';

// @sf-generated-start summary:finPayment
const summary = [
  { key: 'generatedCredit', column: 'Generated_Credit', type: 'amount', label: 'Generated Credit' },
  { key: 'usedCredit', column: 'Used_Credit', type: 'amount', label: 'Used Credit' },
  { key: 'writeoffAmount', column: 'Writeoffamt', type: 'amount', label: 'Write-off Amount' },
];

const statusField = 'status';
// @sf-generated-end summary:finPayment

// @sf-generated-start processes:finPayment
const processes = [
  { name: 'paymentProcess', label: 'Payment Process', style: 'positive', params: [{"name":"action","label":"Action","type":"list","required":true,"options":[{"value":"P","label":"Process"},{"value":"RE","label":"Reactivate"},{"value":"R","label":"Reactivate and Delete Lines"},{"value":"V","label":"Void"}]}] },
  { name: 'reversePayment', label: 'Reverse Payment', style: 'destructive', params: [{"name":"action","type":"hidden","defaultValue":"RV"},{"name":"paymentDate","label":"Payment Date","type":"date","required":true}] },
];
// @sf-generated-end processes:finPayment

// @sf-generated-start addLineFields:finPaymentScheduleDetail
const addLineFields = {
  entry: [
    { key: 'orderPaymentSchedule', column: 'FIN_Payment_Schedule_Order', type: 'search', lookup: true, inputMode: 'search' },
    { key: 'invoicePaymentSchedule', column: 'FIN_Payment_Schedule_Invoice', type: 'search', inputMode: 'search' },
    { key: 'gLItem', column: 'C_Glitem_ID', type: 'search', inputMode: 'search' },
    { key: 'canceled', column: 'Iscanceled', type: 'checkbox', required: true },
    { key: 'businessPartner', column: 'C_Bpartner_ID', type: 'search', inputMode: 'search' },
  ],
  derived: [
    { key: 'amount', column: 'Amount', type: 'number' },
  ],
};
// @sf-generated-end addLineFields:finPaymentScheduleDetail

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
        "canceled",
        "businessPartner"
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

// @sf-generated-start component:FinPaymentPage
export default function FinPaymentPage({ windowName, recordId, ...props }) {
  // @sf-custom-slot hooks:FinPaymentPage
  if (recordId) {
    return (
      <DetailView
        entity="finPayment"
        detailEntity="finPaymentScheduleDetail"
        Form={FinPaymentForm}
        DetailTable={FinPaymentScheduleDetailTable}
        summary={summary}
        statusField={statusField}
        processes={processes}
        addLineFields={addLineFields}
        catalogs={catalogs}
        entityLabel="Fin Payment"
        detailLabel="Fin Payment Schedule Detail"
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
      entity="finPayment"
      Table={FinPaymentTable}
      entityLabel="Fin Payments"
      windowName={windowName}
      breadcrumb={breadcrumb}
      {...props}
    />
  );
}
// @sf-generated-end component:FinPaymentPage

// @sf-custom-slot section:FinPaymentPage-custom

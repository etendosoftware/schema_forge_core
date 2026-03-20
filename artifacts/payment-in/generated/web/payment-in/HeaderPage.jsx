import { ListView, DetailView } from '@/components/contract-ui';
import HeaderTable from './HeaderTable';
import HeaderForm from './HeaderForm';
import LinesTable from './LinesTable';
import LinesForm from './LinesForm';
import catalogs from './mockCatalogs';

const breadcrumb = 'General / Payment In';

// @sf-generated-start summary:header
const summary = [
  { key: 'generatedCredit', column: 'Generated_Credit', type: 'amount' },
  { key: 'usedCredit', column: 'Used_Credit', type: 'amount' },
  { key: 'writeoffAmount', column: 'Writeoffamt', type: 'amount' },
  { key: 'reversedPayment', column: 'FIN_Rev_Payment_ID', type: 'string' },
];

const statusField = 'status';
// @sf-generated-end summary:header

// @sf-generated-start processes:header
const processes = [

];
// @sf-generated-end processes:header

// @sf-generated-start addLineFields:lines
const addLineFields = {
  entry: [
    { key: 'orderPaymentSchedule', column: 'FIN_Payment_Schedule_Order', type: 'search', lookup: true, inputMode: 'search' },
    { key: 'invoicePaymentSchedule', column: 'FIN_Payment_Schedule_Invoice', type: 'search', inputMode: 'search' },
    { key: 'gLItem', column: 'C_Glitem_ID', type: 'search', inputMode: 'search' },
    { key: 'canceled', column: 'Iscanceled', type: 'checkbox', required: true },
    { key: 'businessPartner', column: 'C_Bpartner_ID', type: 'search', inputMode: 'search' },
    { key: 'activity', column: 'C_Activity_ID', type: 'search', reference: 'Activity selector', inputMode: 'search' },
    { key: 'product', column: 'M_Product_ID', type: 'search', inputMode: 'search' },
    { key: 'salesCampaign', column: 'C_Campaign_ID', type: 'search', reference: 'Campaign selector', inputMode: 'search' },
    { key: 'project', column: 'C_Project_ID', type: 'search', inputMode: 'search' },
    { key: 'salesRegion', column: 'C_Salesregion_ID', type: 'search', reference: 'Sales region selector', inputMode: 'search' },
    { key: 'stDimension', column: 'User1_ID', type: 'search', reference: 'User Dimension 1', inputMode: 'search' },
    { key: 'ndDimension', column: 'User2_ID', type: 'search', reference: 'User Dimension 2', inputMode: 'search' },
  ],
  derived: [
    { key: 'amount', column: 'Amount', type: 'number' },
    { key: 'costCenter', column: 'C_Costcenter_ID', type: 'search', reference: 'Cost Center Selector', inputMode: 'search' },
  ],
};
// @sf-generated-end addLineFields:lines

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

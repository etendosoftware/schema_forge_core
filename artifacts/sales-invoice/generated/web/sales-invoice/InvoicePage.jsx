import { ListView, DetailView } from '@/components/contract-ui';
import InvoiceTable from './InvoiceTable';
import InvoiceForm from './InvoiceForm';
import InvoiceLineTable from './InvoiceLineTable';
import InvoiceLineForm from './InvoiceLineForm';
import catalogs from './mockCatalogs';

const breadcrumb = 'Sales / Sales Invoice';

// @sf-generated-start summary:invoice
const summary = [
  { key: 'documentNo', column: 'DocumentNo', type: 'string' },
  { key: 'grandTotalAmount', column: 'GrandTotal', type: 'amount' },
  { key: 'summedLineAmount', column: 'TotalLines', type: 'amount' },
  { key: 'outstandingAmount', column: 'OutstandingAmt', type: 'amount' },
];

const statusField = 'documentStatus';
// @sf-generated-end summary:invoice

// @sf-generated-start processes:invoice
const processes = [
  { name: 'Process Invoice', label: 'Process  Invoice', style: 'positive' },
  { name: 'Add Payment', label: 'Add  Payment', style: 'positive' },
];
// @sf-generated-end processes:invoice

// @sf-generated-start addLineFields:invoiceLine
const addLineFields = {
  entry: [
    { key: 'lineNo', column: 'Line', type: 'number', required: true, lookup: true },
    { key: 'product', column: 'M_Product_ID', type: 'search', reference: 'Product', inputMode: 'search' },
    { key: 'invoicedQuantity', column: 'QtyInvoiced', type: 'text', required: true },
    { key: 'description', column: 'Description', type: 'textarea' },
  ],
  derived: [
    { key: 'unitPrice', column: 'PriceActual', type: 'text' },
    { key: 'tax', column: 'C_Tax_ID', type: 'selector', reference: 'Tax', inputMode: 'selector' },
    { key: 'listPrice', column: 'PriceList', type: 'text' },
  ],
};
// @sf-generated-end addLineFields:invoiceLine

const api = {
  "specName": "sales-invoice",
  "baseUrl": "/sws/neo/sales-invoice",
  "crud": {
    "invoice": {
      "get": true,
      "getById": true,
      "post": true,
      "put": true,
      "patch": true,
      "delete": true,
      "listUrl": "/sws/neo/sales-invoice/invoice",
      "detailUrl": "/sws/neo/sales-invoice/invoice/{id}",
      "supportedFilters": [
        "documentNo",
        "invoiceDate",
        "businessPartner",
        "documentStatus",
        "orderReference"
      ]
    },
    "invoiceLine": {
      "get": true,
      "getById": true,
      "post": true,
      "put": true,
      "patch": true,
      "delete": true,
      "listUrl": "/sws/neo/sales-invoice/invoiceLine",
      "detailUrl": "/sws/neo/sales-invoice/invoiceLine/{id}",
      "supportedFilters": [
        "product"
      ]
    },
    "finPaymentSchedule": {
      "get": true,
      "getById": true,
      "post": true,
      "put": true,
      "patch": true,
      "delete": true,
      "listUrl": "/sws/neo/sales-invoice/finPaymentSchedule",
      "detailUrl": "/sws/neo/sales-invoice/finPaymentSchedule/{id}",
      "supportedFilters": []
    }
  },
  "selectors": [
    {
      "entity": "invoice",
      "field": "businessPartner",
      "column": "C_BPartner_ID",
      "reference": "BusinessPartner",
      "inputMode": "search",
      "url": "/sws/neo/sales-invoice/invoice/selectors/businessPartner"
    },
    {
      "entity": "invoice",
      "field": "partnerAddress",
      "column": "C_BPartner_Location_ID",
      "reference": "BusinessPartnerLocation",
      "inputMode": "dependent",
      "url": "/sws/neo/sales-invoice/invoice/selectors/partnerAddress"
    },
    {
      "entity": "invoice",
      "field": "paymentTerms",
      "column": "C_PaymentTerm_ID",
      "reference": "PaymentTerm",
      "inputMode": "selector",
      "url": "/sws/neo/sales-invoice/invoice/selectors/paymentTerms"
    },
    {
      "entity": "invoice",
      "field": "paymentMethod",
      "column": "FIN_Paymentmethod_ID",
      "reference": "PaymentMethod",
      "inputMode": "selector",
      "url": "/sws/neo/sales-invoice/invoice/selectors/paymentMethod"
    },
    {
      "entity": "invoice",
      "field": "currency",
      "column": "C_Currency_ID",
      "reference": "Currency",
      "inputMode": "selector",
      "url": "/sws/neo/sales-invoice/invoice/selectors/currency"
    },
    {
      "entity": "invoice",
      "field": "priceList",
      "column": "M_PriceList_ID",
      "reference": "PriceList",
      "inputMode": "selector",
      "url": "/sws/neo/sales-invoice/invoice/selectors/priceList"
    },
    {
      "entity": "invoice",
      "field": "salesRepresentative",
      "column": "SalesRep_ID",
      "reference": "User",
      "inputMode": "selector",
      "url": "/sws/neo/sales-invoice/invoice/selectors/salesRepresentative"
    },
    {
      "entity": "invoiceLine",
      "field": "product",
      "column": "M_Product_ID",
      "reference": "Product",
      "inputMode": "search",
      "url": "/sws/neo/sales-invoice/invoiceLine/selectors/product"
    },
    {
      "entity": "invoiceLine",
      "field": "uOM",
      "column": "C_UOM_ID",
      "reference": "UOM",
      "inputMode": "selector",
      "url": "/sws/neo/sales-invoice/invoiceLine/selectors/uOM"
    },
    {
      "entity": "invoiceLine",
      "field": "tax",
      "column": "C_Tax_ID",
      "reference": "Tax",
      "inputMode": "selector",
      "url": "/sws/neo/sales-invoice/invoiceLine/selectors/tax"
    },
    {
      "entity": "finPaymentSchedule",
      "field": "finPaymentmethodID",
      "column": "Fin_Paymentmethod_ID",
      "reference": "Paymentmethod",
      "inputMode": "selector",
      "url": "/sws/neo/sales-invoice/finPaymentSchedule/selectors/finPaymentmethodID"
    },
    {
      "entity": "finPaymentSchedule",
      "field": "currency",
      "column": "C_Currency_ID",
      "reference": "Currency",
      "inputMode": "selector",
      "url": "/sws/neo/sales-invoice/finPaymentSchedule/selectors/currency"
    }
  ],
  "actions": [
    {
      "entity": "invoice",
      "field": "aPRMAddpayment",
      "column": "EM_APRM_Addpayment",
      "url": "/sws/neo/sales-invoice/invoice/{id}/action/aPRMAddpayment"
    },
    {
      "entity": "invoice",
      "field": "posted",
      "column": "Posted",
      "url": "/sws/neo/sales-invoice/invoice/{id}/action/posted"
    },
    {
      "entity": "invoice",
      "field": "aPRMProcessinvoice",
      "column": "EM_APRM_Processinvoice",
      "url": "/sws/neo/sales-invoice/invoice/{id}/action/aPRMProcessinvoice"
    },
    {
      "entity": "invoice",
      "field": "documentAction",
      "column": "DocAction",
      "url": "/sws/neo/sales-invoice/invoice/{id}/action/documentAction"
    },
    {
      "entity": "invoice",
      "field": "createLinesFromOrder",
      "column": "Createfromorders",
      "url": "/sws/neo/sales-invoice/invoice/{id}/action/createLinesFromOrder"
    },
    {
      "entity": "invoice",
      "field": "createLinesFromShipment",
      "column": "Createfrominouts",
      "url": "/sws/neo/sales-invoice/invoice/{id}/action/createLinesFromShipment"
    },
    {
      "entity": "invoice",
      "field": "copyFrom",
      "column": "CopyFrom",
      "url": "/sws/neo/sales-invoice/invoice/{id}/action/copyFrom"
    },
    {
      "entity": "invoice",
      "field": "calculatePromotions",
      "column": "Calculate_Promotions",
      "url": "/sws/neo/sales-invoice/invoice/{id}/action/calculatePromotions"
    },
    {
      "entity": "invoice",
      "field": "processNow",
      "column": "Processing",
      "url": "/sws/neo/sales-invoice/invoice/{id}/action/processNow"
    },
    {
      "entity": "invoice",
      "field": "generateTo",
      "column": "GenerateTo",
      "url": "/sws/neo/sales-invoice/invoice/{id}/action/generateTo"
    },
    {
      "entity": "invoice",
      "field": "createLinesFrom",
      "column": "CreateFrom",
      "url": "/sws/neo/sales-invoice/invoice/{id}/action/createLinesFrom"
    },
    {
      "entity": "invoiceLine",
      "field": "explode",
      "column": "Explode",
      "url": "/sws/neo/sales-invoice/invoiceLine/{id}/action/explode"
    },
    {
      "entity": "invoiceLine",
      "field": "matchLCCosts",
      "column": "Match_Lccosts",
      "url": "/sws/neo/sales-invoice/invoiceLine/{id}/action/matchLCCosts"
    },
    {
      "entity": "finPaymentSchedule",
      "field": "updatePaymentPlan",
      "column": "Update_Payment_Plan",
      "url": "/sws/neo/sales-invoice/finPaymentSchedule/{id}/action/updatePaymentPlan"
    },
    {
      "entity": "finPaymentSchedule",
      "field": "aprmModifPaymentINPlan",
      "column": "EM_Aprm_Modif_Paym_Sched",
      "url": "/sws/neo/sales-invoice/finPaymentSchedule/{id}/action/aprmModifPaymentINPlan"
    },
    {
      "entity": "finPaymentSchedule",
      "field": "aprmModifPaymentOUTPlan",
      "column": "EM_Aprm_Modif_Paym_Out_Sched",
      "url": "/sws/neo/sales-invoice/finPaymentSchedule/{id}/action/aprmModifPaymentOUTPlan"
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
      "example": "_sortBy=sales-invoiceDate"
    },
    "filtering": "Use field name as query param: ?fieldName=value",
    "parentFilter": "parentId={id} for child entities"
  }
};

// @sf-generated-start component:InvoicePage
export default function InvoicePage({ windowName, recordId, ...props }) {
  // @sf-custom-slot hooks:InvoicePage
  if (recordId) {
    return (
      <DetailView
        entity="invoice"
        detailEntity="invoiceLine"
        Form={InvoiceForm}
        DetailTable={InvoiceLineTable}
        DetailForm={InvoiceLineForm}
        summary={summary}
        statusField={statusField}
        processes={processes}
        addLineFields={addLineFields}
        catalogs={catalogs}
        entityLabel="Invoice"
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
      entity="invoice"
      Table={InvoiceTable}
      entityLabel="Invoices"
      windowName={windowName}
      breadcrumb={breadcrumb}
      api={api}
      {...props}
    />
  );
}
// @sf-generated-end component:InvoicePage

// @sf-custom-slot section:InvoicePage-custom

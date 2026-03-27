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

// @sf-custom-start extraBadges:invoice
const extraBadges = [
  { key: 'paymentComplete', label: 'Payment Complete' },
  { key: 'paymentComplete', label: 'Pending Payment', when: false, style: 'warning', hideWhenStatus: ['DR'] },
];
// @sf-custom-end extraBadges:invoice

// @sf-generated-start processes:invoice
const processes = [
  { name: 'Process Invoice', label: 'Process  Invoice', style: 'positive' },
  { name: 'Add Payment', label: 'Add  Payment', style: 'positive' },
];
// @sf-generated-end processes:invoice

// @sf-generated-start addLineFields:invoiceLine
const addLineFields = {
  entry: [
    { key: 'product', column: 'M_Product_ID', type: 'search', lookup: true, label: 'Product', reference: 'Product', inputMode: 'search' },
    { key: 'invoicedQuantity', column: 'QtyInvoiced', type: 'text', required: true, label: 'Invoiced Quantity' },
    { key: 'unitPrice', column: 'PriceActual', type: 'text', required: true, label: 'Net Unit Price' },
    { key: 'tax', column: 'C_Tax_ID', type: 'selector', label: 'Tax', reference: 'Tax', inputMode: 'selector' },
    { key: 'description', column: 'Description', type: 'textarea', label: 'Description' },
  ],
  derived: [

  ],
  hidden: [

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
      "listUrl": "/sws/neo/sales-invoice/invoiceLine",
      "detailUrl": "/sws/neo/sales-invoice/invoiceLine/{id}",
      "supportedFilters": [
        "product"
      ]
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
      "entity": "invoiceLine",
      "field": "product",
      "column": "M_Product_ID",
      "reference": "Product",
      "inputMode": "search",
      "url": "/sws/neo/sales-invoice/invoiceLine/selectors/product"
    },
    {
      "entity": "invoiceLine",
      "field": "tax",
      "column": "C_Tax_ID",
      "reference": "Tax",
      "inputMode": "selector",
      "url": "/sws/neo/sales-invoice/invoiceLine/selectors/tax"
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
        extraBadges={extraBadges}
        processes={processes}
        addLineFields={addLineFields}
        catalogs={catalogs}
        entityLabel="Invoice"
        detailLabel="Lines"
        windowName={windowName}
        recordId={recordId}
        breadcrumb={breadcrumb}
      api={api}
        documentPreview={{ titlePrefix: 'Invoice', pdfUrl: null }}
        notesField="description"
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

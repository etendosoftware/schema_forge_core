import { ListView, DetailView } from '@/components/contract-ui';
import InvoiceTable from './InvoiceTable';
import InvoiceForm from './InvoiceForm';
import InvoiceLineTable from './InvoiceLineTable';
import catalogs from './mockCatalogs';

const breadcrumb = 'Sales / Sales Invoice';

// @sf-generated-start summary:invoice
const summary = [
  { key: 'summedLineAmount', column: 'TotalLines', type: 'amount', label: 'Total Net Amount' },
  { key: 'paymentComplete', column: 'Ispaid', type: 'boolean', label: 'Payment Complete' },
  { key: 'totalPaid', column: 'Totalpaid', type: 'amount', label: 'Total Paid' },
  { key: 'outstandingAmount', column: 'OutstandingAmt', type: 'amount', label: 'Total Outstanding' },
  { key: 'dueAmount', column: 'DueAmt', type: 'amount', label: 'Amount Currently Due' },
  { key: 'daysTillDue', column: 'DaysTillDue', type: 'number', label: 'Days Till Next Due' },
  { key: 'percentageOverdue', column: 'Percentageoverdue', type: 'number', label: 'Percentage Paid Late' },
  { key: 'finalSettlementDate', column: 'Finalsettlement', type: 'date', label: 'Paid in Full Date' },
  { key: 'daysSalesOutstanding', column: 'Daysoutstanding', type: 'number', label: 'Days to Pay in Full' },
  { key: 'salesOrder', column: 'C_Order_ID', type: 'string', label: 'Sales Order' },
  { key: 'externalBusinessPartnerReference', column: 'BPartner_ExtRef', type: 'string', label: 'CRM Reference' },
  { key: 'prepaymentamt', column: 'Prepaymentamt', type: 'amount', label: 'Prepayment Amount' },
  { key: 'paidAmountAtInvoicing', column: 'Paidamtatinvoicing', type: 'amount', label: 'Paid Amount at Invoicing' },
];

const statusField = 'documentStatus';
// @sf-generated-end summary:invoice

// @sf-generated-start processes:invoice
const processes = [

];
// @sf-generated-end processes:invoice

// @sf-generated-start addLineFields:invoiceLine
const addLineFields = {
  entry: [
    { key: 'lineNo', column: 'Line', type: 'number', required: true, lookup: true },
    { key: 'product', column: 'M_Product_ID', type: 'search', reference: 'Product', inputMode: 'search' },
    { key: 'operativeQuantity', column: 'Aumqty', type: 'text' },
    { key: 'operativeUOM', column: 'C_Aum', type: 'dependent', reference: 'UOM', inputMode: 'dependent', dependsOn: { field: 'product', filterKey: 'M_Product_ID' } },
    { key: 'invoicedQuantity', column: 'QtyInvoiced', type: 'text', required: true },
    { key: 'financialInvoiceLine', column: 'Financial_Invoice_Line', type: 'checkbox', required: true },
    { key: 'account', column: 'Account_ID', type: 'search', reference: 'Glitem', inputMode: 'search' },
    { key: 'attributeSetValue', column: 'M_AttributeSetInstance_ID', type: 'text' },
    { key: 'description', column: 'Description', type: 'textarea' },
    { key: 'deferred', column: 'IsDeferred', type: 'checkbox', required: true },
    { key: 'deferredPlanType', column: 'DefPlanType', type: 'text' },
    { key: 'periodNumber', column: 'Periodnumber', type: 'number' },
    { key: 'period', column: 'C_Period_ID', type: 'search', reference: 'Period', inputMode: 'search' },
    { key: 'project', column: 'C_Project_ID', type: 'search', reference: 'Project', inputMode: 'search' },
    { key: 'asset', column: 'A_Asset_ID', type: 'selector', reference: 'Asset', inputMode: 'selector' },
    { key: 'stDimension', column: 'User1_ID', type: 'selector', reference: 'User1', inputMode: 'selector' },
    { key: 'ndDimension', column: 'User2_ID', type: 'selector', reference: 'User2', inputMode: 'selector' },
    { key: 'explode', column: 'Explode', type: 'text' },
    { key: 'businessPartner', column: 'C_Bpartner_ID', type: 'search', reference: 'BPartner', inputMode: 'search' },
  ],
  derived: [
    { key: 'unitPrice', column: 'PriceActual', type: 'text' },
    { key: 'grossUnitPrice', column: 'Gross_Unit_Price', type: 'text' },
    { key: 'tax', column: 'C_Tax_ID', type: 'selector', reference: 'Tax', inputMode: 'selector' },
    { key: 'listPrice', column: 'PriceList', type: 'text' },
    { key: 'taxableAmount', column: 'Taxbaseamt', type: 'number' },
    { key: 'cancelPriceAdjustment', column: 'CANCELPRICEAD', type: 'checkbox' },
    { key: 'costcenter', column: 'C_Costcenter_ID', type: 'selector', reference: 'Costcenter', inputMode: 'selector' },
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
      "inputMode": "search",
      "url": "/sws/neo/sales-invoice/invoice/selectors/salesRepresentative"
    },
    {
      "entity": "invoice",
      "field": "salesOrder",
      "column": "C_Order_ID",
      "reference": "Order",
      "inputMode": "search",
      "url": "/sws/neo/sales-invoice/invoice/selectors/salesOrder"
    },
    {
      "entity": "invoice",
      "field": "project",
      "column": "C_Project_ID",
      "reference": "Project",
      "inputMode": "dependent",
      "url": "/sws/neo/sales-invoice/invoice/selectors/project"
    },
    {
      "entity": "invoice",
      "field": "costcenter",
      "column": "C_Costcenter_ID",
      "reference": "Costcenter",
      "inputMode": "selector",
      "url": "/sws/neo/sales-invoice/invoice/selectors/costcenter"
    },
    {
      "entity": "invoice",
      "field": "salesCampaign",
      "column": "C_Campaign_ID",
      "reference": "Campaign",
      "inputMode": "selector",
      "url": "/sws/neo/sales-invoice/invoice/selectors/salesCampaign"
    },
    {
      "entity": "invoice",
      "field": "stDimension",
      "column": "User1_ID",
      "reference": "User1",
      "inputMode": "selector",
      "url": "/sws/neo/sales-invoice/invoice/selectors/stDimension"
    },
    {
      "entity": "invoice",
      "field": "ndDimension",
      "column": "User2_ID",
      "reference": "User2",
      "inputMode": "selector",
      "url": "/sws/neo/sales-invoice/invoice/selectors/ndDimension"
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
      "field": "operativeUOM",
      "column": "C_Aum",
      "reference": "UOM",
      "inputMode": "dependent",
      "url": "/sws/neo/sales-invoice/invoiceLine/selectors/operativeUOM"
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
      "entity": "invoiceLine",
      "field": "account",
      "column": "Account_ID",
      "reference": "Glitem",
      "inputMode": "search",
      "url": "/sws/neo/sales-invoice/invoiceLine/selectors/account"
    },
    {
      "entity": "invoiceLine",
      "field": "period",
      "column": "C_Period_ID",
      "reference": "Period",
      "inputMode": "search",
      "url": "/sws/neo/sales-invoice/invoiceLine/selectors/period"
    },
    {
      "entity": "invoiceLine",
      "field": "project",
      "column": "C_Project_ID",
      "reference": "Project",
      "inputMode": "search",
      "url": "/sws/neo/sales-invoice/invoiceLine/selectors/project"
    },
    {
      "entity": "invoiceLine",
      "field": "costcenter",
      "column": "C_Costcenter_ID",
      "reference": "Costcenter",
      "inputMode": "selector",
      "url": "/sws/neo/sales-invoice/invoiceLine/selectors/costcenter"
    },
    {
      "entity": "invoiceLine",
      "field": "asset",
      "column": "A_Asset_ID",
      "reference": "Asset",
      "inputMode": "selector",
      "url": "/sws/neo/sales-invoice/invoiceLine/selectors/asset"
    },
    {
      "entity": "invoiceLine",
      "field": "stDimension",
      "column": "User1_ID",
      "reference": "User1",
      "inputMode": "selector",
      "url": "/sws/neo/sales-invoice/invoiceLine/selectors/stDimension"
    },
    {
      "entity": "invoiceLine",
      "field": "ndDimension",
      "column": "User2_ID",
      "reference": "User2",
      "inputMode": "selector",
      "url": "/sws/neo/sales-invoice/invoiceLine/selectors/ndDimension"
    },
    {
      "entity": "invoiceLine",
      "field": "businessPartner",
      "column": "C_Bpartner_ID",
      "reference": "BPartner",
      "inputMode": "search",
      "url": "/sws/neo/sales-invoice/invoiceLine/selectors/businessPartner"
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
      "field": "generateTo",
      "column": "GenerateTo",
      "url": "/sws/neo/sales-invoice/invoice/{id}/action/generateTo"
    },
    {
      "entity": "invoice",
      "field": "processNow",
      "column": "Processing",
      "url": "/sws/neo/sales-invoice/invoice/{id}/action/processNow"
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
        summary={summary}
        statusField={statusField}
        processes={processes}
        addLineFields={addLineFields}
        catalogs={catalogs}
        entityLabel="Invoice"
        detailLabel="Invoice Line"
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
      {...props}
    />
  );
}
// @sf-generated-end component:InvoicePage

// @sf-custom-slot section:InvoicePage-custom

import { ListView, DetailView } from '@/components/contract-ui';
import HeaderTable from './HeaderTable';
import HeaderForm from './HeaderForm';
import LinesTable from './LinesTable';
import LinesForm from './LinesForm';
import catalogs from './mockCatalogs';

const breadcrumb = 'Sales / Sales Invoice';

// @sf-generated-start summary:header
const summary = [
  { key: 'documentNo', column: 'DocumentNo', type: 'string' },
  { key: 'grandTotalAmount', column: 'GrandTotal', type: 'amount' },
  { key: 'summedLineAmount', column: 'TotalLines', type: 'amount' },
  { key: 'paymentComplete', column: 'Ispaid', type: 'boolean' },
  { key: 'totalPaid', column: 'Totalpaid', type: 'amount' },
  { key: 'outstandingAmount', column: 'OutstandingAmt', type: 'amount' },
  { key: 'dueAmount', column: 'DueAmt', type: 'amount' },
  { key: 'daysTillDue', column: 'DaysTillDue', type: 'number' },
  { key: 'percentageOverdue', column: 'Percentageoverdue', type: 'number' },
  { key: 'finalSettlementDate', column: 'Finalsettlement', type: 'date' },
  { key: 'daysSalesOutstanding', column: 'Daysoutstanding', type: 'number' },
  { key: 'salesOrder', column: 'C_Order_ID', type: 'string' },
  { key: 'externalBusinessPartnerReference', column: 'BPartner_ExtRef', type: 'string' },
  { key: 'prepaymentamt', column: 'Prepaymentamt', type: 'amount' },
  { key: 'paidAmountAtInvoicing', column: 'Paidamtatinvoicing', type: 'amount' },
];

const statusField = 'documentStatus';
// @sf-generated-end summary:header

// @sf-generated-start processes:header
const processes = [

];
// @sf-generated-end processes:header

// @sf-generated-start addLineFields:lines
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
// @sf-generated-end addLineFields:lines

const api = {
  "specName": "sales-invoice",
  "baseUrl": "/sws/neo/sales-invoice",
  "crud": {
    "header": {
      "get": true,
      "getById": true,
      "post": true,
      "put": true,
      "patch": true,
      "delete": true,
      "listUrl": "/sws/neo/sales-invoice/header",
      "detailUrl": "/sws/neo/sales-invoice/header/{id}",
      "supportedFilters": [
        "documentNo",
        "invoiceDate",
        "businessPartner",
        "documentStatus",
        "orderReference"
      ]
    },
    "lines": {
      "get": true,
      "getById": true,
      "post": true,
      "put": true,
      "patch": true,
      "delete": true,
      "listUrl": "/sws/neo/sales-invoice/lines",
      "detailUrl": "/sws/neo/sales-invoice/lines/{id}",
      "supportedFilters": [
        "product"
      ]
    }
  },
  "selectors": [
    {
      "entity": "header",
      "field": "businessPartner",
      "column": "C_BPartner_ID",
      "reference": "BusinessPartner",
      "inputMode": "search",
      "url": "/sws/neo/sales-invoice/header/selectors/businessPartner"
    },
    {
      "entity": "header",
      "field": "partnerAddress",
      "column": "C_BPartner_Location_ID",
      "reference": "BusinessPartnerLocation",
      "inputMode": "dependent",
      "url": "/sws/neo/sales-invoice/header/selectors/partnerAddress"
    },
    {
      "entity": "header",
      "field": "paymentTerms",
      "column": "C_PaymentTerm_ID",
      "reference": "PaymentTerm",
      "inputMode": "selector",
      "url": "/sws/neo/sales-invoice/header/selectors/paymentTerms"
    },
    {
      "entity": "header",
      "field": "paymentMethod",
      "column": "FIN_Paymentmethod_ID",
      "reference": "PaymentMethod",
      "inputMode": "selector",
      "url": "/sws/neo/sales-invoice/header/selectors/paymentMethod"
    },
    {
      "entity": "header",
      "field": "currency",
      "column": "C_Currency_ID",
      "reference": "Currency",
      "inputMode": "selector",
      "url": "/sws/neo/sales-invoice/header/selectors/currency"
    },
    {
      "entity": "header",
      "field": "priceList",
      "column": "M_PriceList_ID",
      "reference": "PriceList",
      "inputMode": "selector",
      "url": "/sws/neo/sales-invoice/header/selectors/priceList"
    },
    {
      "entity": "header",
      "field": "salesRepresentative",
      "column": "SalesRep_ID",
      "reference": "User",
      "inputMode": "search",
      "url": "/sws/neo/sales-invoice/header/selectors/salesRepresentative"
    },
    {
      "entity": "header",
      "field": "salesOrder",
      "column": "C_Order_ID",
      "reference": "Order",
      "inputMode": "search",
      "url": "/sws/neo/sales-invoice/header/selectors/salesOrder"
    },
    {
      "entity": "header",
      "field": "project",
      "column": "C_Project_ID",
      "reference": "Project",
      "inputMode": "dependent",
      "url": "/sws/neo/sales-invoice/header/selectors/project"
    },
    {
      "entity": "header",
      "field": "costcenter",
      "column": "C_Costcenter_ID",
      "reference": "Costcenter",
      "inputMode": "selector",
      "url": "/sws/neo/sales-invoice/header/selectors/costcenter"
    },
    {
      "entity": "header",
      "field": "salesCampaign",
      "column": "C_Campaign_ID",
      "reference": "Campaign",
      "inputMode": "selector",
      "url": "/sws/neo/sales-invoice/header/selectors/salesCampaign"
    },
    {
      "entity": "header",
      "field": "stDimension",
      "column": "User1_ID",
      "reference": "User1",
      "inputMode": "selector",
      "url": "/sws/neo/sales-invoice/header/selectors/stDimension"
    },
    {
      "entity": "header",
      "field": "ndDimension",
      "column": "User2_ID",
      "reference": "User2",
      "inputMode": "selector",
      "url": "/sws/neo/sales-invoice/header/selectors/ndDimension"
    },
    {
      "entity": "lines",
      "field": "product",
      "column": "M_Product_ID",
      "reference": "Product",
      "inputMode": "search",
      "url": "/sws/neo/sales-invoice/lines/selectors/product"
    },
    {
      "entity": "lines",
      "field": "operativeUOM",
      "column": "C_Aum",
      "reference": "UOM",
      "inputMode": "dependent",
      "url": "/sws/neo/sales-invoice/lines/selectors/operativeUOM"
    },
    {
      "entity": "lines",
      "field": "uOM",
      "column": "C_UOM_ID",
      "reference": "UOM",
      "inputMode": "selector",
      "url": "/sws/neo/sales-invoice/lines/selectors/uOM"
    },
    {
      "entity": "lines",
      "field": "tax",
      "column": "C_Tax_ID",
      "reference": "Tax",
      "inputMode": "selector",
      "url": "/sws/neo/sales-invoice/lines/selectors/tax"
    },
    {
      "entity": "lines",
      "field": "account",
      "column": "Account_ID",
      "reference": "Glitem",
      "inputMode": "search",
      "url": "/sws/neo/sales-invoice/lines/selectors/account"
    },
    {
      "entity": "lines",
      "field": "period",
      "column": "C_Period_ID",
      "reference": "Period",
      "inputMode": "search",
      "url": "/sws/neo/sales-invoice/lines/selectors/period"
    },
    {
      "entity": "lines",
      "field": "project",
      "column": "C_Project_ID",
      "reference": "Project",
      "inputMode": "search",
      "url": "/sws/neo/sales-invoice/lines/selectors/project"
    },
    {
      "entity": "lines",
      "field": "costcenter",
      "column": "C_Costcenter_ID",
      "reference": "Costcenter",
      "inputMode": "selector",
      "url": "/sws/neo/sales-invoice/lines/selectors/costcenter"
    },
    {
      "entity": "lines",
      "field": "asset",
      "column": "A_Asset_ID",
      "reference": "Asset",
      "inputMode": "selector",
      "url": "/sws/neo/sales-invoice/lines/selectors/asset"
    },
    {
      "entity": "lines",
      "field": "stDimension",
      "column": "User1_ID",
      "reference": "User1",
      "inputMode": "selector",
      "url": "/sws/neo/sales-invoice/lines/selectors/stDimension"
    },
    {
      "entity": "lines",
      "field": "ndDimension",
      "column": "User2_ID",
      "reference": "User2",
      "inputMode": "selector",
      "url": "/sws/neo/sales-invoice/lines/selectors/ndDimension"
    },
    {
      "entity": "lines",
      "field": "businessPartner",
      "column": "C_Bpartner_ID",
      "reference": "BPartner",
      "inputMode": "search",
      "url": "/sws/neo/sales-invoice/lines/selectors/businessPartner"
    }
  ],
  "actions": [
    {
      "entity": "header",
      "field": "aPRMAddpayment",
      "column": "EM_APRM_Addpayment",
      "url": "/sws/neo/sales-invoice/header/{id}/action/aPRMAddpayment"
    },
    {
      "entity": "header",
      "field": "posted",
      "column": "Posted",
      "url": "/sws/neo/sales-invoice/header/{id}/action/posted"
    },
    {
      "entity": "header",
      "field": "aPRMProcessinvoice",
      "column": "EM_APRM_Processinvoice",
      "url": "/sws/neo/sales-invoice/header/{id}/action/aPRMProcessinvoice"
    },
    {
      "entity": "header",
      "field": "documentAction",
      "column": "DocAction",
      "url": "/sws/neo/sales-invoice/header/{id}/action/documentAction"
    },
    {
      "entity": "header",
      "field": "createLinesFromOrder",
      "column": "Createfromorders",
      "url": "/sws/neo/sales-invoice/header/{id}/action/createLinesFromOrder"
    },
    {
      "entity": "header",
      "field": "createLinesFromShipment",
      "column": "Createfrominouts",
      "url": "/sws/neo/sales-invoice/header/{id}/action/createLinesFromShipment"
    },
    {
      "entity": "header",
      "field": "copyFrom",
      "column": "CopyFrom",
      "url": "/sws/neo/sales-invoice/header/{id}/action/copyFrom"
    },
    {
      "entity": "header",
      "field": "calculatePromotions",
      "column": "Calculate_Promotions",
      "url": "/sws/neo/sales-invoice/header/{id}/action/calculatePromotions"
    },
    {
      "entity": "header",
      "field": "generateTo",
      "column": "GenerateTo",
      "url": "/sws/neo/sales-invoice/header/{id}/action/generateTo"
    },
    {
      "entity": "header",
      "field": "processNow",
      "column": "Processing",
      "url": "/sws/neo/sales-invoice/header/{id}/action/processNow"
    },
    {
      "entity": "header",
      "field": "createLinesFrom",
      "column": "CreateFrom",
      "url": "/sws/neo/sales-invoice/header/{id}/action/createLinesFrom"
    },
    {
      "entity": "lines",
      "field": "explode",
      "column": "Explode",
      "url": "/sws/neo/sales-invoice/lines/{id}/action/explode"
    },
    {
      "entity": "lines",
      "field": "matchLCCosts",
      "column": "Match_Lccosts",
      "url": "/sws/neo/sales-invoice/lines/{id}/action/matchLCCosts"
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

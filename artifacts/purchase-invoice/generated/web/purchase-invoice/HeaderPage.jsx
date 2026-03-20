import { ListView, DetailView } from '@/components/contract-ui';
import HeaderTable from './HeaderTable';
import HeaderForm from './HeaderForm';
import LinesTable from './LinesTable';
import LinesForm from './LinesForm';
import BasicDiscountsTable from './BasicDiscountsTable';
import BasicDiscountsForm from './BasicDiscountsForm';
import PaymentPlanTable from './PaymentPlanTable';
import PaymentPlanForm from './PaymentPlanForm';
import AccountingTable from './AccountingTable';
import AccountingForm from './AccountingForm';
import ReversedInvoicesTable from './ReversedInvoicesTable';
import ReversedInvoicesForm from './ReversedInvoicesForm';
import catalogs from './mockCatalogs';

const breadcrumb = 'Purchases / Purchase Invoice';

// @sf-generated-start summary:header
const summary = [
  { key: 'documentNo', column: 'DocumentNo', type: 'string' },
  { key: 'salesOrder', column: 'C_Order_ID', type: 'string' },
  { key: 'grandTotalAmount', column: 'GrandTotal', type: 'amount' },
  { key: 'summedLineAmount', column: 'TotalLines', type: 'amount' },
  { key: 'paymentComplete', column: 'Ispaid', type: 'boolean' },
  { key: 'totalPaid', column: 'Totalpaid', type: 'amount' },
  { key: 'outstandingAmount', column: 'OutstandingAmt', type: 'amount' },
  { key: 'orderDate', column: 'DateOrdered', type: 'date' },
  { key: 'dueAmount', column: 'DueAmt', type: 'amount' },
  { key: 'withholdingAmount', column: 'Withholdingamount', type: 'amount' },
  { key: 'prepaymentAmount', column: 'Prepaymentamt', type: 'amount' },
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
    { key: 'account', column: 'Account_ID', type: 'search', reference: 'GLAccount', inputMode: 'search' },
    { key: 'operativeQuantity', column: 'Aumqty', type: 'text' },
    { key: 'operativeUOM', column: 'C_Aum', type: 'selector', reference: 'UOM', inputMode: 'selector' },
    { key: 'invoicedQuantity', column: 'QtyInvoiced', type: 'text', required: true },
    { key: 'description', column: 'Description', type: 'textarea' },
    { key: 'attributeSetValue', column: 'M_AttributeSetInstance_ID', type: 'text' },
    { key: 'project', column: 'C_Project_ID', type: 'search', reference: 'Project', inputMode: 'search' },
    { key: 'asset', column: 'A_Asset_ID', type: 'selector', reference: 'Asset', inputMode: 'selector' },
    { key: 'stDimension', column: 'User1_ID', type: 'selector', reference: 'UserDimension1', inputMode: 'selector' },
    { key: 'ndDimension', column: 'User2_ID', type: 'selector', reference: 'UserDimension2', inputMode: 'selector' },
  ],
  derived: [
    { key: 'unitPrice', column: 'PriceActual', type: 'text' },
    { key: 'tax', column: 'C_Tax_ID', type: 'selector', reference: 'Tax', inputMode: 'selector' },
    { key: 'costcenter', column: 'C_Costcenter_ID', type: 'selector', reference: 'CostCenter', inputMode: 'selector' },
  ],
};
// @sf-generated-end addLineFields:lines

const api = {
  "specName": "purchase-invoice",
  "baseUrl": "/sws/neo/purchase-invoice",
  "crud": {
    "header": {
      "get": true,
      "getById": true,
      "post": true,
      "put": true,
      "patch": true,
      "delete": true,
      "listUrl": "/sws/neo/purchase-invoice/header",
      "detailUrl": "/sws/neo/purchase-invoice/header/{id}",
      "supportedFilters": [
        "documentNo",
        "invoiceDate",
        "businessPartner",
        "orderReference",
        "documentStatus"
      ]
    },
    "lines": {
      "get": true,
      "getById": true,
      "post": true,
      "put": true,
      "patch": true,
      "delete": true,
      "listUrl": "/sws/neo/purchase-invoice/lines",
      "detailUrl": "/sws/neo/purchase-invoice/lines/{id}",
      "supportedFilters": []
    },
    "tax": {
      "get": true,
      "getById": true,
      "post": true,
      "put": true,
      "patch": true,
      "delete": true,
      "listUrl": "/sws/neo/purchase-invoice/tax",
      "detailUrl": "/sws/neo/purchase-invoice/tax/{id}",
      "supportedFilters": []
    },
    "basicDiscounts": {
      "get": true,
      "getById": true,
      "post": true,
      "put": true,
      "patch": true,
      "delete": true,
      "listUrl": "/sws/neo/purchase-invoice/basicDiscounts",
      "detailUrl": "/sws/neo/purchase-invoice/basicDiscounts/{id}",
      "supportedFilters": []
    },
    "paymentPlan": {
      "get": true,
      "getById": true,
      "post": true,
      "put": true,
      "patch": true,
      "delete": true,
      "listUrl": "/sws/neo/purchase-invoice/paymentPlan",
      "detailUrl": "/sws/neo/purchase-invoice/paymentPlan/{id}",
      "supportedFilters": []
    },
    "reversedInvoices": {
      "get": true,
      "getById": true,
      "post": true,
      "put": true,
      "patch": true,
      "delete": true,
      "listUrl": "/sws/neo/purchase-invoice/reversedInvoices",
      "detailUrl": "/sws/neo/purchase-invoice/reversedInvoices/{id}",
      "supportedFilters": []
    },
    "accounting": {
      "get": true,
      "getById": true,
      "post": true,
      "put": true,
      "patch": true,
      "delete": true,
      "listUrl": "/sws/neo/purchase-invoice/accounting",
      "detailUrl": "/sws/neo/purchase-invoice/accounting/{id}",
      "supportedFilters": []
    }
  },
  "selectors": [
    {
      "entity": "header",
      "field": "transactionDocument",
      "column": "C_DocTypeTarget_ID",
      "reference": "DocumentType",
      "inputMode": "selector",
      "url": "/sws/neo/purchase-invoice/header/selectors/transactionDocument"
    },
    {
      "entity": "header",
      "field": "businessPartner",
      "column": "C_BPartner_ID",
      "reference": "BusinessPartner",
      "inputMode": "search",
      "url": "/sws/neo/purchase-invoice/header/selectors/businessPartner"
    },
    {
      "entity": "header",
      "field": "partnerAddress",
      "column": "C_BPartner_Location_ID",
      "reference": "BusinessPartnerLocation",
      "inputMode": "dependent",
      "url": "/sws/neo/purchase-invoice/header/selectors/partnerAddress"
    },
    {
      "entity": "header",
      "field": "priceList",
      "column": "M_PriceList_ID",
      "reference": "PriceList",
      "inputMode": "selector",
      "url": "/sws/neo/purchase-invoice/header/selectors/priceList"
    },
    {
      "entity": "header",
      "field": "paymentTerms",
      "column": "C_PaymentTerm_ID",
      "reference": "PaymentTerm",
      "inputMode": "selector",
      "url": "/sws/neo/purchase-invoice/header/selectors/paymentTerms"
    },
    {
      "entity": "header",
      "field": "paymentMethod",
      "column": "FIN_Paymentmethod_ID",
      "reference": "PaymentMethod",
      "inputMode": "selector",
      "url": "/sws/neo/purchase-invoice/header/selectors/paymentMethod"
    },
    {
      "entity": "header",
      "field": "salesOrder",
      "column": "C_Order_ID",
      "reference": "Order",
      "inputMode": "selector",
      "url": "/sws/neo/purchase-invoice/header/selectors/salesOrder"
    },
    {
      "entity": "header",
      "field": "currency",
      "column": "C_Currency_ID",
      "reference": "Currency",
      "inputMode": "selector",
      "url": "/sws/neo/purchase-invoice/header/selectors/currency"
    },
    {
      "entity": "header",
      "field": "userContact",
      "column": "AD_User_ID",
      "reference": "User",
      "inputMode": "search",
      "url": "/sws/neo/purchase-invoice/header/selectors/userContact"
    },
    {
      "entity": "header",
      "field": "salesRepresentative",
      "column": "SalesRep_ID",
      "reference": "User",
      "inputMode": "search",
      "url": "/sws/neo/purchase-invoice/header/selectors/salesRepresentative"
    },
    {
      "entity": "header",
      "field": "charge",
      "column": "C_Charge_ID",
      "reference": "Charge",
      "inputMode": "selector",
      "url": "/sws/neo/purchase-invoice/header/selectors/charge"
    },
    {
      "entity": "header",
      "field": "project",
      "column": "C_Project_ID",
      "reference": "Project",
      "inputMode": "search",
      "url": "/sws/neo/purchase-invoice/header/selectors/project"
    },
    {
      "entity": "header",
      "field": "costcenter",
      "column": "C_Costcenter_ID",
      "reference": "CostCenter",
      "inputMode": "selector",
      "url": "/sws/neo/purchase-invoice/header/selectors/costcenter"
    },
    {
      "entity": "header",
      "field": "asset",
      "column": "A_Asset_ID",
      "reference": "Asset",
      "inputMode": "selector",
      "url": "/sws/neo/purchase-invoice/header/selectors/asset"
    },
    {
      "entity": "header",
      "field": "stDimension",
      "column": "User1_ID",
      "reference": "UserDimension1",
      "inputMode": "selector",
      "url": "/sws/neo/purchase-invoice/header/selectors/stDimension"
    },
    {
      "entity": "header",
      "field": "ndDimension",
      "column": "User2_ID",
      "reference": "UserDimension2",
      "inputMode": "selector",
      "url": "/sws/neo/purchase-invoice/header/selectors/ndDimension"
    },
    {
      "entity": "lines",
      "field": "product",
      "column": "M_Product_ID",
      "reference": "Product",
      "inputMode": "search",
      "url": "/sws/neo/purchase-invoice/lines/selectors/product"
    },
    {
      "entity": "lines",
      "field": "account",
      "column": "Account_ID",
      "reference": "GLAccount",
      "inputMode": "search",
      "url": "/sws/neo/purchase-invoice/lines/selectors/account"
    },
    {
      "entity": "lines",
      "field": "operativeUOM",
      "column": "C_Aum",
      "reference": "UOM",
      "inputMode": "selector",
      "url": "/sws/neo/purchase-invoice/lines/selectors/operativeUOM"
    },
    {
      "entity": "lines",
      "field": "uOM",
      "column": "C_UOM_ID",
      "reference": "UOM",
      "inputMode": "selector",
      "url": "/sws/neo/purchase-invoice/lines/selectors/uOM"
    },
    {
      "entity": "lines",
      "field": "tax",
      "column": "C_Tax_ID",
      "reference": "Tax",
      "inputMode": "selector",
      "url": "/sws/neo/purchase-invoice/lines/selectors/tax"
    },
    {
      "entity": "lines",
      "field": "salesOrderLine",
      "column": "C_OrderLine_ID",
      "reference": "OrderLine",
      "inputMode": "selector",
      "url": "/sws/neo/purchase-invoice/lines/selectors/salesOrderLine"
    },
    {
      "entity": "lines",
      "field": "goodsShipmentLine",
      "column": "M_InOutLine_ID",
      "reference": "GoodsShipmentLine",
      "inputMode": "selector",
      "url": "/sws/neo/purchase-invoice/lines/selectors/goodsShipmentLine"
    },
    {
      "entity": "lines",
      "field": "project",
      "column": "C_Project_ID",
      "reference": "Project",
      "inputMode": "search",
      "url": "/sws/neo/purchase-invoice/lines/selectors/project"
    },
    {
      "entity": "lines",
      "field": "costcenter",
      "column": "C_Costcenter_ID",
      "reference": "CostCenter",
      "inputMode": "selector",
      "url": "/sws/neo/purchase-invoice/lines/selectors/costcenter"
    },
    {
      "entity": "lines",
      "field": "asset",
      "column": "A_Asset_ID",
      "reference": "Asset",
      "inputMode": "selector",
      "url": "/sws/neo/purchase-invoice/lines/selectors/asset"
    },
    {
      "entity": "lines",
      "field": "stDimension",
      "column": "User1_ID",
      "reference": "UserDimension1",
      "inputMode": "selector",
      "url": "/sws/neo/purchase-invoice/lines/selectors/stDimension"
    },
    {
      "entity": "lines",
      "field": "ndDimension",
      "column": "User2_ID",
      "reference": "UserDimension2",
      "inputMode": "selector",
      "url": "/sws/neo/purchase-invoice/lines/selectors/ndDimension"
    },
    {
      "entity": "tax",
      "field": "tax",
      "column": "C_Tax_ID",
      "reference": "Tax",
      "inputMode": "selector",
      "url": "/sws/neo/purchase-invoice/tax/selectors/tax"
    },
    {
      "entity": "basicDiscounts",
      "field": "discount",
      "column": "C_Discount_ID",
      "reference": "Discount",
      "inputMode": "selector",
      "url": "/sws/neo/purchase-invoice/basicDiscounts/selectors/discount"
    },
    {
      "entity": "paymentPlan",
      "field": "paymentMethod",
      "column": "Fin_Paymentmethod_ID",
      "reference": "PaymentMethod",
      "inputMode": "selector",
      "url": "/sws/neo/purchase-invoice/paymentPlan/selectors/paymentMethod"
    },
    {
      "entity": "paymentPlan",
      "field": "currency",
      "column": "C_Currency_ID",
      "reference": "Currency",
      "inputMode": "selector",
      "url": "/sws/neo/purchase-invoice/paymentPlan/selectors/currency"
    },
    {
      "entity": "reversedInvoices",
      "field": "reversedInvoice",
      "column": "Reversed_C_Invoice_ID",
      "reference": "Invoice",
      "inputMode": "search",
      "url": "/sws/neo/purchase-invoice/reversedInvoices/selectors/reversedInvoice"
    },
    {
      "entity": "accounting",
      "field": "accountingSchema",
      "column": "C_AcctSchema_ID",
      "reference": "AcctSchema",
      "inputMode": "selector",
      "url": "/sws/neo/purchase-invoice/accounting/selectors/accountingSchema"
    },
    {
      "entity": "accounting",
      "field": "currency",
      "column": "C_Currency_ID",
      "reference": "Currency",
      "inputMode": "selector",
      "url": "/sws/neo/purchase-invoice/accounting/selectors/currency"
    },
    {
      "entity": "accounting",
      "field": "period",
      "column": "C_Period_ID",
      "reference": "Period",
      "inputMode": "selector",
      "url": "/sws/neo/purchase-invoice/accounting/selectors/period"
    },
    {
      "entity": "accounting",
      "field": "account",
      "column": "Account_ID",
      "url": "/sws/neo/purchase-invoice/accounting/selectors/account"
    },
    {
      "entity": "accounting",
      "field": "businessPartner",
      "column": "C_BPartner_ID",
      "reference": "BPartner",
      "inputMode": "search",
      "url": "/sws/neo/purchase-invoice/accounting/selectors/businessPartner"
    },
    {
      "entity": "accounting",
      "field": "product",
      "column": "M_Product_ID",
      "reference": "Product",
      "inputMode": "search",
      "url": "/sws/neo/purchase-invoice/accounting/selectors/product"
    },
    {
      "entity": "accounting",
      "field": "project",
      "column": "C_Project_ID",
      "reference": "Project",
      "inputMode": "selector",
      "url": "/sws/neo/purchase-invoice/accounting/selectors/project"
    },
    {
      "entity": "accounting",
      "field": "costcenter",
      "column": "C_Costcenter_ID",
      "reference": "Costcenter",
      "inputMode": "selector",
      "url": "/sws/neo/purchase-invoice/accounting/selectors/costcenter"
    },
    {
      "entity": "accounting",
      "field": "asset",
      "column": "A_Asset_ID",
      "reference": "Asset",
      "inputMode": "selector",
      "url": "/sws/neo/purchase-invoice/accounting/selectors/asset"
    },
    {
      "entity": "accounting",
      "field": "stDimension",
      "column": "User1_ID",
      "reference": "User1",
      "inputMode": "selector",
      "url": "/sws/neo/purchase-invoice/accounting/selectors/stDimension"
    },
    {
      "entity": "accounting",
      "field": "ndDimension",
      "column": "User2_ID",
      "reference": "User2",
      "inputMode": "selector",
      "url": "/sws/neo/purchase-invoice/accounting/selectors/ndDimension"
    }
  ],
  "actions": [
    {
      "entity": "header",
      "field": "generateTo",
      "column": "GenerateTo",
      "url": "/sws/neo/purchase-invoice/header/{id}/action/generateTo"
    },
    {
      "entity": "header",
      "field": "aPRMAddpayment",
      "column": "EM_APRM_Addpayment",
      "url": "/sws/neo/purchase-invoice/header/{id}/action/aPRMAddpayment"
    },
    {
      "entity": "header",
      "field": "posted",
      "column": "Posted",
      "url": "/sws/neo/purchase-invoice/header/{id}/action/posted"
    },
    {
      "entity": "header",
      "field": "aPRMProcessinvoice",
      "column": "EM_APRM_Processinvoice",
      "url": "/sws/neo/purchase-invoice/header/{id}/action/aPRMProcessinvoice"
    },
    {
      "entity": "header",
      "field": "documentAction",
      "column": "DocAction",
      "url": "/sws/neo/purchase-invoice/header/{id}/action/documentAction"
    },
    {
      "entity": "header",
      "field": "createLinesFromOrder",
      "column": "Createfromorders",
      "url": "/sws/neo/purchase-invoice/header/{id}/action/createLinesFromOrder"
    },
    {
      "entity": "header",
      "field": "createLinesFromShipment",
      "column": "Createfrominouts",
      "url": "/sws/neo/purchase-invoice/header/{id}/action/createLinesFromShipment"
    },
    {
      "entity": "header",
      "field": "copyFrom",
      "column": "CopyFrom",
      "url": "/sws/neo/purchase-invoice/header/{id}/action/copyFrom"
    },
    {
      "entity": "header",
      "field": "calculatePromotions",
      "column": "Calculate_Promotions",
      "url": "/sws/neo/purchase-invoice/header/{id}/action/calculatePromotions"
    },
    {
      "entity": "header",
      "field": "processNow",
      "column": "Processing",
      "url": "/sws/neo/purchase-invoice/header/{id}/action/processNow"
    },
    {
      "entity": "header",
      "field": "createLinesFrom",
      "column": "CreateFrom",
      "url": "/sws/neo/purchase-invoice/header/{id}/action/createLinesFrom"
    },
    {
      "entity": "lines",
      "field": "explode",
      "column": "Explode",
      "url": "/sws/neo/purchase-invoice/lines/{id}/action/explode"
    },
    {
      "entity": "lines",
      "field": "matchLCCosts",
      "column": "Match_Lccosts",
      "url": "/sws/neo/purchase-invoice/lines/{id}/action/matchLCCosts"
    },
    {
      "entity": "paymentPlan",
      "field": "updatePaymentPlan",
      "column": "Update_Payment_Plan",
      "url": "/sws/neo/purchase-invoice/paymentPlan/{id}/action/updatePaymentPlan"
    },
    {
      "entity": "paymentPlan",
      "field": "aprmModifPaymentOUTPlan",
      "column": "EM_Aprm_Modif_Paym_Out_Sched",
      "url": "/sws/neo/purchase-invoice/paymentPlan/{id}/action/aprmModifPaymentOUTPlan"
    },
    {
      "entity": "paymentPlan",
      "field": "aprmModifPaymentINPlan",
      "column": "EM_Aprm_Modif_Paym_Sched",
      "url": "/sws/neo/purchase-invoice/paymentPlan/{id}/action/aprmModifPaymentINPlan"
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
      "example": "_sortBy=purchase-invoiceDate"
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
        secondaryTabs={[
          { key: 'basicDiscounts', label: 'Basic Discounts', Table: BasicDiscountsTable, Form: BasicDiscountsForm },
          { key: 'paymentPlan', label: 'Payment Plan', Table: PaymentPlanTable, Form: PaymentPlanForm },
          { key: 'accounting', label: 'Accounting', Table: AccountingTable, Form: AccountingForm },
          { key: 'reversedInvoices', label: 'Reversed Invoices', Table: ReversedInvoicesTable, Form: ReversedInvoicesForm },
        ]}
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

import { useEffect } from 'react';
import { ListView, DetailView } from '@/components/contract-ui';
import { RETURN_ORDER_LINE_CONFIG } from '@/hooks/useLineGrossAmount';
import HeaderTable from './HeaderTable';
import HeaderForm from './HeaderForm';
import LinesTable from './LinesTable';
import LinesForm from './LinesForm';
import BasicDiscountsTable from './BasicDiscountsTable';
import BasicDiscountsForm from './BasicDiscountsForm';
import RelatedDocuments from '../../../custom/RelatedDocuments';
import { AttachmentsTab } from '@/components/attachments';
import ReturnToVendorBottomPanel from '../../../custom/ReturnToVendorBottomPanel';
import catalogs from './mockCatalogs';


const breadcrumb = 'Purchases / Return to Vendor';


// @sf-generated-start summary:header
const summary = [
  { key: 'grandTotalAmount', column: 'GrandTotal', type: 'amount' },
  { key: 'summedLineAmount', column: 'TotalLines', type: 'amount' },
  { key: 'currency', column: 'C_Currency_ID', type: 'selector' },
  { key: 'delivered', column: 'IsDelivered', type: 'boolean' },
];

const statusField = 'documentStatus';
// @sf-generated-end summary:header

// @sf-generated-start extraBadges:header
const extraBadges = [];
// @sf-generated-end extraBadges:header

// @sf-generated-start processes:header
const processes = [
  { name: 'documentAction', label: 'Process Order', style: 'positive',
    displayLogicRaw: "@DocStatus@!'VO'&@DocStatus@!'CL'" },
  { name: 'rMPickfromreceipt', label: 'Pick/Edit Lines', style: 'positive',
    displayLogicRaw: "@Processed@='N'" },
  { name: 'rMAddOrphanLine', label: 'Insert Orphan Line', style: 'positive',
    displayLogicRaw: "@Processed@='N' & @RMAllowOprhanLine@='Y'" },
];
// @sf-generated-end processes:header

// @sf-generated-start draftMode:header
const draftMode = null;
// @sf-generated-end draftMode:header

// @sf-generated-start requiredHeaderFields:header
const requiredHeaderFields = ['documentAction', 'orderDate', 'businessPartner', 'partnerAddress', 'warehouse', 'paymentTerms', 'priceList', 'documentStatus', 'grandTotalAmount', 'summedLineAmount', 'currency', 'delivered'];
// @sf-generated-end requiredHeaderFields:header

// @sf-generated-start addLineFields:lines
const addLineFields = {
  entry: [
    { key: 'description', column: 'Description', type: 'textarea', label: 'Description' },
    { key: 'project', column: 'C_Project_ID', type: 'search', lookup: true, label: 'Project', reference: 'Project', inputMode: 'search' },
    { key: 'costcenter', column: 'C_Costcenter_ID', type: 'selector', label: 'Cost Center', reference: 'Costcenter', inputMode: 'selector' },
    { key: 'stDimension', column: 'User1_ID', type: 'selector', label: '1st Dimension', reference: 'User1', inputMode: 'selector' },
    { key: 'ndDimension', column: 'User2_ID', type: 'selector', label: '2nd Dimension', reference: 'User2', inputMode: 'selector' },
  ],
  derived: [

  ],
  hidden: [

  ],
};
// @sf-generated-end addLineFields:lines

export const api = {
  "specName": "return-to-vendor",
  "baseUrl": "/sws/neo/return-to-vendor",
  "crud": {
    "header": {
      "get": true,
      "getById": true,
      "post": true,
      "put": true,
      "patch": true,
      "delete": true,
      "listUrl": "/sws/neo/return-to-vendor/header",
      "detailUrl": "/sws/neo/return-to-vendor/header/{id}",
      "supportedFilters": [
        "businessPartner"
      ]
    },
    "lines": {
      "get": true,
      "getById": true,
      "post": true,
      "put": true,
      "patch": true,
      "delete": true,
      "listUrl": "/sws/neo/return-to-vendor/lines",
      "detailUrl": "/sws/neo/return-to-vendor/lines/{id}",
      "supportedFilters": []
    },
    "lineTax": {
      "get": true,
      "getById": true,
      "post": true,
      "put": true,
      "patch": true,
      "delete": true,
      "listUrl": "/sws/neo/return-to-vendor/lineTax",
      "detailUrl": "/sws/neo/return-to-vendor/lineTax/{id}",
      "supportedFilters": []
    },
    "basicDiscounts": {
      "get": true,
      "getById": true,
      "post": true,
      "put": true,
      "patch": true,
      "delete": true,
      "listUrl": "/sws/neo/return-to-vendor/basicDiscounts",
      "detailUrl": "/sws/neo/return-to-vendor/basicDiscounts/{id}",
      "supportedFilters": []
    },
    "tax": {
      "get": true,
      "getById": true,
      "post": true,
      "put": true,
      "patch": true,
      "delete": true,
      "listUrl": "/sws/neo/return-to-vendor/tax",
      "detailUrl": "/sws/neo/return-to-vendor/tax/{id}",
      "supportedFilters": []
    },
    "paymentOutPlan": {
      "get": true,
      "getById": true,
      "post": true,
      "put": true,
      "patch": true,
      "delete": true,
      "listUrl": "/sws/neo/return-to-vendor/paymentOutPlan",
      "detailUrl": "/sws/neo/return-to-vendor/paymentOutPlan/{id}",
      "supportedFilters": []
    },
    "paymentOutDetails": {
      "get": true,
      "getById": true,
      "post": true,
      "put": true,
      "patch": true,
      "delete": true,
      "listUrl": "/sws/neo/return-to-vendor/paymentOutDetails",
      "detailUrl": "/sws/neo/return-to-vendor/paymentOutDetails/{id}",
      "supportedFilters": []
    }
  },
  "selectors": [
    {
      "entity": "header",
      "field": "businessPartner",
      "column": "C_BPartner_ID",
      "reference": "BusinessPartner",
      "inputMode": "search",
      "url": "/sws/neo/return-to-vendor/header/selectors/businessPartner"
    },
    {
      "entity": "header",
      "field": "partnerAddress",
      "column": "C_BPartner_Location_ID",
      "reference": "BusinessPartnerLocation",
      "inputMode": "dependent",
      "url": "/sws/neo/return-to-vendor/header/selectors/partnerAddress",
      "context": {
        "required": [
          {
            "param": "C_BPartner_ID",
            "source": "field",
            "field": "businessPartner"
          }
        ]
      }
    },
    {
      "entity": "header",
      "field": "cReturnReasonID",
      "column": "C_Return_Reason_ID",
      "reference": "Return_Reason",
      "inputMode": "selector",
      "url": "/sws/neo/return-to-vendor/header/selectors/cReturnReasonID"
    },
    {
      "entity": "header",
      "field": "warehouse",
      "column": "M_Warehouse_ID",
      "reference": "Warehouse",
      "inputMode": "selector",
      "url": "/sws/neo/return-to-vendor/header/selectors/warehouse"
    },
    {
      "entity": "header",
      "field": "paymentMethod",
      "column": "FIN_Paymentmethod_ID",
      "reference": "Paymentmethod",
      "inputMode": "selector",
      "url": "/sws/neo/return-to-vendor/header/selectors/paymentMethod",
      "context": {
        "required": [
          {
            "param": "IsSOTrx",
            "source": "windowCategory"
          }
        ]
      }
    },
    {
      "entity": "header",
      "field": "paymentTerms",
      "column": "C_PaymentTerm_ID",
      "reference": "PaymentTerm",
      "inputMode": "selector",
      "url": "/sws/neo/return-to-vendor/header/selectors/paymentTerms"
    },
    {
      "entity": "header",
      "field": "priceList",
      "column": "M_PriceList_ID",
      "reference": "PriceList",
      "inputMode": "selector",
      "url": "/sws/neo/return-to-vendor/header/selectors/priceList",
      "context": {
        "required": [
          {
            "param": "isSOTrx",
            "source": "windowCategory"
          }
        ]
      }
    },
    {
      "entity": "header",
      "field": "currency",
      "column": "C_Currency_ID",
      "reference": "Currency",
      "inputMode": "selector",
      "url": "/sws/neo/return-to-vendor/header/selectors/currency"
    },
    {
      "entity": "header",
      "field": "project",
      "column": "C_Project_ID",
      "reference": "Project",
      "inputMode": "search",
      "url": "/sws/neo/return-to-vendor/header/selectors/project",
      "context": {
        "required": [
          {
            "param": "IsSOTrx",
            "source": "windowCategory"
          },
          {
            "param": "C_BPartner_ID",
            "source": "parentField",
            "field": "businessPartner"
          }
        ]
      }
    },
    {
      "entity": "header",
      "field": "costcenter",
      "column": "C_Costcenter_ID",
      "reference": "Costcenter",
      "inputMode": "selector",
      "url": "/sws/neo/return-to-vendor/header/selectors/costcenter"
    },
    {
      "entity": "header",
      "field": "stDimension",
      "column": "User1_ID",
      "reference": "User1",
      "inputMode": "selector",
      "url": "/sws/neo/return-to-vendor/header/selectors/stDimension"
    },
    {
      "entity": "header",
      "field": "ndDimension",
      "column": "User2_ID",
      "reference": "User2",
      "inputMode": "selector",
      "url": "/sws/neo/return-to-vendor/header/selectors/ndDimension"
    },
    {
      "entity": "lines",
      "field": "product",
      "column": "M_Product_ID",
      "reference": "Product",
      "inputMode": "search",
      "url": "/sws/neo/return-to-vendor/lines/selectors/product"
    },
    {
      "entity": "lines",
      "field": "cReturnReasonID",
      "column": "C_Return_Reason_ID",
      "reference": "Return_Reason",
      "inputMode": "selector",
      "url": "/sws/neo/return-to-vendor/lines/selectors/cReturnReasonID"
    },
    {
      "entity": "lines",
      "field": "operativeUOM",
      "column": "C_Aum",
      "reference": "UOM",
      "inputMode": "search",
      "url": "/sws/neo/return-to-vendor/lines/selectors/operativeUOM",
      "context": {
        "required": [
          {
            "param": "IsSOTrx",
            "source": "windowCategory"
          }
        ]
      }
    },
    {
      "entity": "lines",
      "field": "uOM",
      "column": "C_UOM_ID",
      "reference": "UOM",
      "inputMode": "selector",
      "url": "/sws/neo/return-to-vendor/lines/selectors/uOM"
    },
    {
      "entity": "lines",
      "field": "goodsShipmentLine",
      "column": "M_Inoutline_ID",
      "reference": "InOutLine",
      "inputMode": "selector",
      "url": "/sws/neo/return-to-vendor/lines/selectors/goodsShipmentLine"
    },
    {
      "entity": "lines",
      "field": "tax",
      "column": "C_Tax_ID",
      "reference": "Tax",
      "inputMode": "selector",
      "url": "/sws/neo/return-to-vendor/lines/selectors/tax",
      "context": {
        "required": [
          {
            "param": "IsSOTrx",
            "source": "windowCategory"
          },
          {
            "param": "DateInvoiced",
            "source": "parentField",
            "field": "invoiceDate",
            "fallbackField": "orderDate",
            "format": "DD-MM-YYYY"
          }
        ]
      }
    },
    {
      "entity": "lines",
      "field": "project",
      "column": "C_Project_ID",
      "reference": "Project",
      "inputMode": "search",
      "url": "/sws/neo/return-to-vendor/lines/selectors/project"
    },
    {
      "entity": "lines",
      "field": "costcenter",
      "column": "C_Costcenter_ID",
      "reference": "Costcenter",
      "inputMode": "selector",
      "url": "/sws/neo/return-to-vendor/lines/selectors/costcenter"
    },
    {
      "entity": "lines",
      "field": "stDimension",
      "column": "User1_ID",
      "reference": "User1",
      "inputMode": "selector",
      "url": "/sws/neo/return-to-vendor/lines/selectors/stDimension"
    },
    {
      "entity": "lines",
      "field": "ndDimension",
      "column": "User2_ID",
      "reference": "User2",
      "inputMode": "selector",
      "url": "/sws/neo/return-to-vendor/lines/selectors/ndDimension"
    },
    {
      "entity": "lineTax",
      "field": "tax",
      "column": "C_Tax_ID",
      "reference": "Tax",
      "inputMode": "selector",
      "url": "/sws/neo/return-to-vendor/lineTax/selectors/tax"
    },
    {
      "entity": "basicDiscounts",
      "field": "discount",
      "column": "C_Discount_ID",
      "reference": "Discount",
      "inputMode": "selector",
      "url": "/sws/neo/return-to-vendor/basicDiscounts/selectors/discount"
    },
    {
      "entity": "tax",
      "field": "tax",
      "column": "C_Tax_ID",
      "reference": "Tax",
      "inputMode": "selector",
      "url": "/sws/neo/return-to-vendor/tax/selectors/tax"
    },
    {
      "entity": "paymentOutPlan",
      "field": "paymentMethod",
      "column": "FIN_Paymentmethod_ID",
      "reference": "Paymentmethod",
      "inputMode": "search",
      "url": "/sws/neo/return-to-vendor/paymentOutPlan/selectors/paymentMethod"
    },
    {
      "entity": "paymentOutPlan",
      "field": "currency",
      "column": "C_Currency_ID",
      "reference": "Currency",
      "inputMode": "search",
      "url": "/sws/neo/return-to-vendor/paymentOutPlan/selectors/currency"
    },
    {
      "entity": "paymentOutDetails",
      "field": "payment",
      "column": "FIN_Payment_ID",
      "reference": "Payment",
      "inputMode": "selector",
      "url": "/sws/neo/return-to-vendor/paymentOutDetails/selectors/payment"
    },
    {
      "entity": "paymentOutDetails",
      "field": "paymentMethod",
      "column": "Fin_Paymentmethod_ID",
      "reference": "Paymentmethod",
      "inputMode": "search",
      "url": "/sws/neo/return-to-vendor/paymentOutDetails/selectors/paymentMethod"
    },
    {
      "entity": "paymentOutDetails",
      "field": "finFinancialAccountID",
      "column": "Fin_Financial_Account_ID",
      "reference": "Financial_Account",
      "inputMode": "search",
      "url": "/sws/neo/return-to-vendor/paymentOutDetails/selectors/finFinancialAccountID"
    }
  ],
  "actions": [
    {
      "name": "documentAction",
      "label": "Process Order",
      "actionType": "documentAction",
      "entity": "header",
      "column": "DocAction",
      "requiresRecord": true,
      "endpoint": "/sws/neo/return-to-vendor/header/{id}/action/documentAction",
      "method": "POST",
      "url": "/sws/neo/return-to-vendor/header/{id}/action/documentAction",
      "parameters": [
        {
          "name": "docAction",
          "type": "string",
          "required": true,
          "description": "Document action code (e.g. CO=Complete, VO=Void, RE=Reactivate)"
        }
      ],
      "preconditions": [
        {
          "field": "documentStatus",
          "operator": "in",
          "values": [
            "DR",
            "IP"
          ],
          "description": "Document must be in draft or in-progress state"
        }
      ],
      "effects": [
        "Updates document status",
        "May trigger workflow transitions"
      ],
      "dryRunSupported": true,
      "edgeCases": [
        "Document is already completed or closed",
        "Document has pending lines or missing required fields",
        "User lacks permission to execute the action"
      ],
      "provenance": "extracted",
      "processId": "104",
      "processType": "classic"
    },
    {
      "name": "rMPickfromreceipt",
      "label": "Pick/Edit Lines",
      "actionType": "createFrom",
      "entity": "header",
      "column": "RM_Pickfromreceipt",
      "requiresRecord": true,
      "endpoint": "/sws/neo/return-to-vendor/header/{id}/action/rMPickfromreceipt",
      "method": "POST",
      "url": "/sws/neo/return-to-vendor/header/{id}/action/rMPickfromreceipt",
      "parameters": [],
      "preconditions": [],
      "effects": [
        "Creates child or related records",
        "May copy data from source document"
      ],
      "dryRunSupported": false,
      "edgeCases": [
        "Source document has no valid lines to copy",
        "Target entity already has linked records",
        "Required reference data is missing (price list, warehouse, etc.)"
      ],
      "provenance": "extracted",
      "processId": "A2C19D0EF6594D14A64BC62E99A89CC3",
      "processType": "obuiapp"
    },
    {
      "name": "generateTemplate",
      "label": "Generate template",
      "actionType": "createFrom",
      "entity": "header",
      "column": "Generatetemplate",
      "requiresRecord": true,
      "endpoint": "/sws/neo/return-to-vendor/header/{id}/action/generateTemplate",
      "method": "POST",
      "url": "/sws/neo/return-to-vendor/header/{id}/action/generateTemplate",
      "parameters": [],
      "preconditions": [],
      "effects": [
        "Creates child or related records",
        "May copy data from source document"
      ],
      "dryRunSupported": false,
      "edgeCases": [
        "Source document has no valid lines to copy",
        "Target entity already has linked records",
        "Required reference data is missing (price list, warehouse, etc.)"
      ],
      "provenance": "extracted",
      "processId": "800022",
      "processType": "classic"
    },
    {
      "name": "rMReceiveMaterials",
      "label": "RM_ReceiveMaterials",
      "actionType": "createFrom",
      "entity": "header",
      "column": "RM_ReceiveMaterials",
      "requiresRecord": true,
      "endpoint": "/sws/neo/return-to-vendor/header/{id}/action/rMReceiveMaterials",
      "method": "POST",
      "url": "/sws/neo/return-to-vendor/header/{id}/action/rMReceiveMaterials",
      "parameters": [],
      "preconditions": [],
      "effects": [
        "Creates child or related records",
        "May copy data from source document"
      ],
      "dryRunSupported": false,
      "edgeCases": [
        "Source document has no valid lines to copy",
        "Target entity already has linked records",
        "Required reference data is missing (price list, warehouse, etc.)"
      ],
      "provenance": "extracted"
    },
    {
      "name": "rMCreateInvoice",
      "label": "Create Invoice",
      "actionType": "createFrom",
      "entity": "header",
      "column": "RM_CreateInvoice",
      "requiresRecord": true,
      "endpoint": "/sws/neo/return-to-vendor/header/{id}/action/rMCreateInvoice",
      "method": "POST",
      "url": "/sws/neo/return-to-vendor/header/{id}/action/rMCreateInvoice",
      "parameters": [],
      "preconditions": [],
      "effects": [
        "Creates child or related records",
        "May copy data from source document"
      ],
      "dryRunSupported": false,
      "edgeCases": [
        "Source document has no valid lines to copy",
        "Target entity already has linked records",
        "Required reference data is missing (price list, warehouse, etc.)"
      ],
      "provenance": "extracted",
      "processId": "FF80808133362F6A013336781FCE0066",
      "processType": "classic"
    },
    {
      "name": "copyFrom",
      "label": "Copy Lines",
      "actionType": "createFrom",
      "entity": "header",
      "column": "CopyFrom",
      "requiresRecord": true,
      "endpoint": "/sws/neo/return-to-vendor/header/{id}/action/copyFrom",
      "method": "POST",
      "url": "/sws/neo/return-to-vendor/header/{id}/action/copyFrom",
      "parameters": [],
      "preconditions": [],
      "effects": [
        "Creates child or related records",
        "May copy data from source document"
      ],
      "dryRunSupported": false,
      "edgeCases": [
        "Source document has no valid lines to copy",
        "Target entity already has linked records",
        "Required reference data is missing (price list, warehouse, etc.)"
      ],
      "provenance": "extracted",
      "processId": "211",
      "processType": "classic"
    },
    {
      "name": "copyFromPO",
      "label": "Copy from Order",
      "actionType": "createFrom",
      "entity": "header",
      "column": "CopyFromPO",
      "requiresRecord": true,
      "endpoint": "/sws/neo/return-to-vendor/header/{id}/action/copyFromPO",
      "method": "POST",
      "url": "/sws/neo/return-to-vendor/header/{id}/action/copyFromPO",
      "parameters": [],
      "preconditions": [],
      "effects": [
        "Creates child or related records",
        "May copy data from source document"
      ],
      "dryRunSupported": false,
      "edgeCases": [
        "Source document has no valid lines to copy",
        "Target entity already has linked records",
        "Required reference data is missing (price list, warehouse, etc.)"
      ],
      "provenance": "extracted",
      "processId": "8B81D80B06364566B87853FEECAB5DE0",
      "processType": "obuiapp"
    },
    {
      "name": "rMAddOrphanLine",
      "label": "Insert Orphan Line",
      "actionType": "utilityAction",
      "entity": "header",
      "column": "RM_AddOrphanLine",
      "requiresRecord": true,
      "endpoint": "/sws/neo/return-to-vendor/header/{id}/action/rMAddOrphanLine",
      "method": "POST",
      "url": "/sws/neo/return-to-vendor/header/{id}/action/rMAddOrphanLine",
      "parameters": [],
      "preconditions": [],
      "effects": [
        "May update related records"
      ],
      "dryRunSupported": false,
      "edgeCases": [
        "Required context is missing",
        "User lacks permission",
        "Record is in an incompatible state"
      ],
      "provenance": "extracted",
      "processId": "23D1B163EC0B41F790CE39BF01DA320E",
      "processType": "classic"
    },
    {
      "name": "processNow",
      "label": "Process Order",
      "actionType": "documentAction",
      "entity": "header",
      "column": "Processing",
      "requiresRecord": true,
      "endpoint": "/sws/neo/return-to-vendor/header/{id}/action/processNow",
      "method": "POST",
      "url": "/sws/neo/return-to-vendor/header/{id}/action/processNow",
      "parameters": [
        {
          "name": "docAction",
          "type": "string",
          "required": true,
          "description": "Document action code (e.g. CO=Complete, VO=Void, RE=Reactivate)"
        }
      ],
      "preconditions": [
        {
          "field": "documentStatus",
          "operator": "in",
          "values": [
            "DR",
            "IP"
          ],
          "description": "Document must be in draft or in-progress state"
        }
      ],
      "effects": [
        "Updates document status",
        "May trigger workflow transitions"
      ],
      "dryRunSupported": true,
      "edgeCases": [
        "Document is already completed or closed",
        "Document has pending lines or missing required fields",
        "User lacks permission to execute the action"
      ],
      "provenance": "extracted",
      "processId": "104",
      "processType": "classic"
    },
    {
      "name": "posted",
      "label": "Posted",
      "actionType": "documentAction",
      "entity": "header",
      "column": "Posted",
      "requiresRecord": true,
      "endpoint": "/sws/neo/return-to-vendor/header/{id}/action/posted",
      "method": "POST",
      "url": "/sws/neo/return-to-vendor/header/{id}/action/posted",
      "parameters": [
        {
          "name": "docAction",
          "type": "string",
          "required": true,
          "description": "Document action code (e.g. CO=Complete, VO=Void, RE=Reactivate)"
        }
      ],
      "preconditions": [
        {
          "field": "documentStatus",
          "operator": "in",
          "values": [
            "DR",
            "IP"
          ],
          "description": "Document must be in draft or in-progress state"
        }
      ],
      "effects": [
        "Updates document status",
        "May trigger workflow transitions"
      ],
      "dryRunSupported": true,
      "edgeCases": [
        "Document is already completed or closed",
        "Document has pending lines or missing required fields",
        "User lacks permission to execute the action"
      ],
      "provenance": "extracted",
      "processId": "57496FB9CF9E4E8F847224017941570E",
      "processType": "obuiapp"
    },
    {
      "name": "calculatePromotions",
      "label": "Calculate_Promotions",
      "actionType": "utilityAction",
      "entity": "header",
      "column": "Calculate_Promotions",
      "requiresRecord": true,
      "endpoint": "/sws/neo/return-to-vendor/header/{id}/action/calculatePromotions",
      "method": "POST",
      "url": "/sws/neo/return-to-vendor/header/{id}/action/calculatePromotions",
      "parameters": [],
      "preconditions": [],
      "effects": [
        "May update related records"
      ],
      "dryRunSupported": false,
      "edgeCases": [
        "Required context is missing",
        "User lacks permission",
        "Record is in an incompatible state"
      ],
      "provenance": "extracted",
      "processId": "9EB2228A60684C0DBEC12D5CD8D85218",
      "processType": "classic"
    },
    {
      "name": "cancelandreplace",
      "label": "Cancelandreplace",
      "actionType": "utilityAction",
      "entity": "header",
      "column": "Cancelandreplace",
      "requiresRecord": true,
      "endpoint": "/sws/neo/return-to-vendor/header/{id}/action/cancelandreplace",
      "method": "POST",
      "url": "/sws/neo/return-to-vendor/header/{id}/action/cancelandreplace",
      "parameters": [],
      "preconditions": [],
      "effects": [
        "May update related records"
      ],
      "dryRunSupported": false,
      "edgeCases": [
        "Required context is missing",
        "User lacks permission",
        "Record is in an incompatible state"
      ],
      "provenance": "extracted",
      "processId": "A2FAF49712D1445ABE750315CE1B473A",
      "processType": "obuiapp"
    },
    {
      "name": "confirmcancelandreplace",
      "label": "Confirmcancelandreplace",
      "actionType": "utilityAction",
      "entity": "header",
      "column": "Confirmcancelandreplace",
      "requiresRecord": true,
      "endpoint": "/sws/neo/return-to-vendor/header/{id}/action/confirmcancelandreplace",
      "method": "POST",
      "url": "/sws/neo/return-to-vendor/header/{id}/action/confirmcancelandreplace",
      "parameters": [],
      "preconditions": [],
      "effects": [
        "May update related records"
      ],
      "dryRunSupported": false,
      "edgeCases": [
        "Required context is missing",
        "User lacks permission",
        "Record is in an incompatible state"
      ],
      "provenance": "extracted",
      "processId": "0C2AFAEFB67B4CB8A1429195EB119A49",
      "processType": "obuiapp"
    },
    {
      "name": "createOrder",
      "label": "Convertquotation",
      "actionType": "createFrom",
      "entity": "header",
      "column": "Convertquotation",
      "requiresRecord": true,
      "endpoint": "/sws/neo/return-to-vendor/header/{id}/action/createOrder",
      "method": "POST",
      "url": "/sws/neo/return-to-vendor/header/{id}/action/createOrder",
      "parameters": [],
      "preconditions": [],
      "effects": [
        "Creates child or related records",
        "May copy data from source document"
      ],
      "dryRunSupported": false,
      "edgeCases": [
        "Source document has no valid lines to copy",
        "Target entity already has linked records",
        "Required reference data is missing (price list, warehouse, etc.)"
      ],
      "provenance": "extracted",
      "processId": "A3FE1F9892394386A49FB707AA50A0FA",
      "processType": "classic"
    },
    {
      "name": "createPOLines",
      "label": "Create_POLines",
      "actionType": "createFrom",
      "entity": "header",
      "column": "Create_POLines",
      "requiresRecord": true,
      "endpoint": "/sws/neo/return-to-vendor/header/{id}/action/createPOLines",
      "method": "POST",
      "url": "/sws/neo/return-to-vendor/header/{id}/action/createPOLines",
      "parameters": [],
      "preconditions": [],
      "effects": [
        "Creates child or related records",
        "May copy data from source document"
      ],
      "dryRunSupported": false,
      "edgeCases": [
        "Source document has no valid lines to copy",
        "Target entity already has linked records",
        "Required reference data is missing (price list, warehouse, etc.)"
      ],
      "provenance": "extracted",
      "processId": "6995A4C2592D434A9E16B71E1694CBCA",
      "processType": "obuiapp"
    },
    {
      "name": "aPRMAddPayment",
      "label": "EM_APRM_AddPayment",
      "actionType": "paymentAction",
      "entity": "header",
      "column": "EM_APRM_AddPayment",
      "requiresRecord": true,
      "endpoint": "/sws/neo/return-to-vendor/header/{id}/action/aPRMAddPayment",
      "method": "POST",
      "url": "/sws/neo/return-to-vendor/header/{id}/action/aPRMAddPayment",
      "parameters": [],
      "preconditions": [],
      "effects": [
        "Creates or processes payment records",
        "May update invoice/order payment status"
      ],
      "dryRunSupported": false,
      "edgeCases": [
        "Payment amount exceeds remaining balance",
        "Payment method is not configured for the business partner",
        "Invoice is already fully paid"
      ],
      "provenance": "extracted",
      "processId": "9BED7889E1034FE68BD85D5D16857320",
      "processType": "obuiapp"
    },
    {
      "name": "rMPickFromShipment",
      "label": "RM_PickFromShipment",
      "actionType": "createFrom",
      "entity": "header",
      "column": "RM_PickFromShipment",
      "requiresRecord": true,
      "endpoint": "/sws/neo/return-to-vendor/header/{id}/action/rMPickFromShipment",
      "method": "POST",
      "url": "/sws/neo/return-to-vendor/header/{id}/action/rMPickFromShipment",
      "parameters": [],
      "preconditions": [],
      "effects": [
        "Creates child or related records",
        "May copy data from source document"
      ],
      "dryRunSupported": false,
      "edgeCases": [
        "Source document has no valid lines to copy",
        "Target entity already has linked records",
        "Required reference data is missing (price list, warehouse, etc.)"
      ],
      "provenance": "extracted",
      "processId": "A2C19D0EF6594D14A64BC62E99A89CC3",
      "processType": "obuiapp"
    },
    {
      "name": "explode",
      "label": "Explode",
      "actionType": "utilityAction",
      "entity": "lines",
      "column": "Explode",
      "requiresRecord": true,
      "endpoint": "/sws/neo/return-to-vendor/lines/{id}/action/explode",
      "method": "POST",
      "url": "/sws/neo/return-to-vendor/lines/{id}/action/explode",
      "parameters": [],
      "preconditions": [],
      "effects": [
        "May update related records"
      ],
      "dryRunSupported": false,
      "edgeCases": [
        "Required context is missing",
        "User lacks permission",
        "Record is in an incompatible state"
      ],
      "provenance": "extracted",
      "processId": "DFC78024B1F54CBB95DC73425BA6687F",
      "processType": "classic"
    },
    {
      "name": "managePrereservation",
      "label": "Manage_Prereservation",
      "actionType": "utilityAction",
      "entity": "lines",
      "column": "Manage_Prereservation",
      "requiresRecord": true,
      "endpoint": "/sws/neo/return-to-vendor/lines/{id}/action/managePrereservation",
      "method": "POST",
      "url": "/sws/neo/return-to-vendor/lines/{id}/action/managePrereservation",
      "parameters": [],
      "preconditions": [],
      "effects": [
        "May update related records"
      ],
      "dryRunSupported": false,
      "edgeCases": [
        "Required context is missing",
        "User lacks permission",
        "Record is in an incompatible state"
      ],
      "provenance": "extracted",
      "processId": "70E42AD47E5F4698A9ACCCAF3EB72B9E",
      "processType": "obuiapp"
    },
    {
      "name": "manageReservation",
      "label": "Manage_Reservation",
      "actionType": "utilityAction",
      "entity": "lines",
      "column": "Manage_Reservation",
      "requiresRecord": true,
      "endpoint": "/sws/neo/return-to-vendor/lines/{id}/action/manageReservation",
      "method": "POST",
      "url": "/sws/neo/return-to-vendor/lines/{id}/action/manageReservation",
      "parameters": [],
      "preconditions": [],
      "effects": [
        "May update related records"
      ],
      "dryRunSupported": false,
      "edgeCases": [
        "Required context is missing",
        "User lacks permission",
        "Record is in an incompatible state"
      ],
      "provenance": "extracted",
      "processId": "5F547560D3DE401AA0B570F22E2C6C06",
      "processType": "obuiapp"
    },
    {
      "name": "selectOrderLine",
      "label": "Relate_Orderline",
      "actionType": "utilityAction",
      "entity": "lines",
      "column": "Relate_Orderline",
      "requiresRecord": true,
      "endpoint": "/sws/neo/return-to-vendor/lines/{id}/action/selectOrderLine",
      "method": "POST",
      "url": "/sws/neo/return-to-vendor/lines/{id}/action/selectOrderLine",
      "parameters": [],
      "preconditions": [],
      "effects": [
        "May update related records"
      ],
      "dryRunSupported": false,
      "edgeCases": [
        "Required context is missing",
        "User lacks permission",
        "Record is in an incompatible state"
      ],
      "provenance": "extracted",
      "processId": "C4265E27C8134096B49DFBF69369DFC6",
      "processType": "obuiapp"
    },
    {
      "name": "updatePaymentPlan",
      "label": "Update_Payment_Plan",
      "actionType": "paymentAction",
      "entity": "paymentOutPlan",
      "column": "Update_Payment_Plan",
      "requiresRecord": true,
      "endpoint": "/sws/neo/return-to-vendor/paymentOutPlan/{id}/action/updatePaymentPlan",
      "method": "POST",
      "url": "/sws/neo/return-to-vendor/paymentOutPlan/{id}/action/updatePaymentPlan",
      "parameters": [],
      "preconditions": [],
      "effects": [
        "Creates or processes payment records",
        "May update invoice/order payment status"
      ],
      "dryRunSupported": false,
      "edgeCases": [
        "Payment amount exceeds remaining balance",
        "Payment method is not configured for the business partner",
        "Invoice is already fully paid"
      ],
      "provenance": "extracted",
      "processId": "FB740AB61B0E42B198D2C88D3A0D0CE6",
      "processType": "classic"
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
      "example": "_sortBy=creationDate desc"
    },
    "filtering": "Use field name as query param: ?fieldName=value",
    "parentFilter": "parentId={id} for child entities"
  },
  "window": {
    "category": "purchases"
  }
};

// @sf-generated-start component:HeaderPage
export default function HeaderPage({ windowName, recordId, ...props }) {
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
        extraBadges={extraBadges}
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
        ]}
        notesField="returnReason"
        customTabs={[{ key: 'related', label: 'Related Documents', Component: RelatedDocuments }, { key: 'attachments', labelKey: 'attachments', Component: AttachmentsTab, placement: 'tab', props: { tableName: "C_Order", config: {} } }]}
        bottomSection={ReturnToVendorBottomPanel}
        requiredHeaderFields={requiredHeaderFields}
        lineConfig={RETURN_ORDER_LINE_CONFIG}
        linesLayout="inlineEditable"
        {...props}
      />
    );
  }

  return (
    <ListView
      entity="header"
      Table={HeaderTable}
      entityLabel="Return to Vendor"
      windowName={windowName}
      breadcrumb={breadcrumb}
      api={api}
      dateFilterKey="orderDate"
      rowQuickActions={{}}
      {...props}
    />
  );
}
// @sf-generated-end component:HeaderPage

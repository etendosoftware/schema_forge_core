import { useEffect } from 'react';
import { ListView, DetailView } from '@/components/contract-ui';
import { toast } from 'sonner';
import { INVOICE_LINE_CONFIG } from '@/hooks/useLineGrossAmount';
import HeaderTable from '../../../custom/InvoiceHeaderTable';
import HeaderForm from './HeaderForm';
import LinesTable from './LinesTable';
import LinesForm from './LinesForm';
import RelatedDocuments from '../../../custom/RelatedDocuments';
import { AttachmentsTab } from '@/components/attachments';
import InvoiceBottomPanel from '../../../custom/InvoiceBottomPanel';
import InvoiceTopbarExtra from '../../../custom/InvoiceTopbarExtra';
import catalogs from './mockCatalogs';


const breadcrumb = 'Sales / Sales Invoice';

const labelOverrides = {
  "es_ES": {
    "OutstandingAmt": "Pendiente de pago",
    "EM_Etgo_Due_Date": "Vencimiento",
    "em_etgo_delivery_status": "Estado de entrega"
  },
  "en_US": {
    "OutstandingAmt": "Pending Payment",
    "EM_Etgo_Due_Date": "Due Date",
    "em_etgo_delivery_status": "Delivery Status"
  }
};


// @sf-generated-start summary:header
const summary = [
  { key: 'documentNo', column: 'DocumentNo', type: 'string' },
  { key: 'grandTotalAmount', column: 'GrandTotal', type: 'amount' },
  { key: 'summedLineAmount', column: 'TotalLines', type: 'amount' },
];

const statusField = 'documentStatus';
// @sf-generated-end summary:header

// @sf-generated-start extraBadges:header
const extraBadges = [];
// @sf-generated-end extraBadges:header

// @sf-generated-start processes:header
const processes = [

];
// @sf-generated-end processes:header

// @sf-generated-start draftMode:header
const draftMode = {
  "enabled": true,
  "processField": "documentAction",
  "processValue": "CO",
  "label": "Confirm"
};
// @sf-generated-end draftMode:header

// @sf-generated-start requiredHeaderFields:header
const requiredHeaderFields = ['documentNo', 'invoiceDate', 'businessPartner', 'partnerAddress', 'paymentTerms', 'paymentMethod', 'grandTotalAmount', 'summedLineAmount', 'priceList'];
// @sf-generated-end requiredHeaderFields:header

// @sf-generated-start addLineFields:lines
const addLineFields = {
  entry: [
    { key: 'product', column: 'M_Product_ID', type: 'search', lookup: true, label: 'Product', reference: 'Product', inputMode: 'search', forceCalloutFields: ["listPrice","unitPrice","tax","uOM","grossUnitPrice"] },
    { key: 'description', column: 'Description', type: 'textarea', label: 'Description' },
    { key: 'invoicedQuantity', column: 'QtyInvoiced', type: 'number', required: true, label: 'Invoiced Quantity', defaultValue: 1 },
    { key: 'listPrice', column: 'PriceList', type: 'number', required: true, label: 'List Price' },
    { key: 'etgoDiscount', column: 'EM_Etgo_Discount', type: 'number', label: 'Discount %', defaultValue: 0 },
    { key: 'tax', column: 'C_Tax_ID', type: 'selector', label: 'Tax', reference: 'Tax', inputMode: 'selector', forceCalloutFields: ["lineNetAmount"] },
  ],
  derived: [

  ],
  hidden: [
    { key: 'grossUnitPrice', value: '0' },
  ],
};
// @sf-generated-end addLineFields:lines

export const api = {
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
        "eTGODueDate"
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
    },
    "paymentPlan": {
      "get": true,
      "getById": true,
      "post": true,
      "put": true,
      "patch": true,
      "delete": true,
      "listUrl": "/sws/neo/sales-invoice/paymentPlan",
      "detailUrl": "/sws/neo/sales-invoice/paymentPlan/{id}",
      "supportedFilters": []
    }
  },
  "selectors": [
    {
      "entity": "header",
      "field": "adOrgId",
      "column": "AD_Org_ID",
      "reference": "Org",
      "inputMode": "selector",
      "url": "/sws/neo/sales-invoice/header/selectors/adOrgId"
    },
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
      "url": "/sws/neo/sales-invoice/header/selectors/partnerAddress",
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
      "url": "/sws/neo/sales-invoice/header/selectors/paymentMethod",
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
      "url": "/sws/neo/sales-invoice/header/selectors/priceList",
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
      "field": "aeatsiiDescription",
      "column": "EM_Aeatsii_Description_ID",
      "reference": "aeatsii_description",
      "inputMode": "selector",
      "url": "/sws/neo/sales-invoice/header/selectors/aeatsiiDescription"
    },
    {
      "entity": "header",
      "field": "aeatsiiCauseExemption",
      "column": "EM_Aeatsii_Cause_Exemption_ID",
      "reference": "aeatsii_cause_exemption",
      "inputMode": "selector",
      "url": "/sws/neo/sales-invoice/header/selectors/aeatsiiCauseExemption"
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
      "field": "tax",
      "column": "C_Tax_ID",
      "reference": "Tax",
      "inputMode": "selector",
      "url": "/sws/neo/sales-invoice/lines/selectors/tax",
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
      "entity": "paymentPlan",
      "field": "finPaymentmethodID",
      "column": "Fin_Paymentmethod_ID",
      "reference": "Paymentmethod",
      "inputMode": "selector",
      "url": "/sws/neo/sales-invoice/paymentPlan/selectors/finPaymentmethodID"
    },
    {
      "entity": "paymentPlan",
      "field": "currency",
      "column": "C_Currency_ID",
      "reference": "Currency",
      "inputMode": "selector",
      "url": "/sws/neo/sales-invoice/paymentPlan/selectors/currency"
    }
  ],
  "actions": [
    {
      "name": "aPRMAddpayment",
      "label": "Add Payment",
      "actionType": "paymentAction",
      "entity": "header",
      "column": "EM_APRM_Addpayment",
      "requiresRecord": true,
      "endpoint": "/sws/neo/sales-invoice/header/{id}/action/aPRMAddpayment",
      "method": "POST",
      "url": "/sws/neo/sales-invoice/header/{id}/action/aPRMAddpayment",
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
      "name": "posted",
      "label": "Posted",
      "actionType": "documentAction",
      "entity": "header",
      "column": "Posted",
      "requiresRecord": true,
      "endpoint": "/sws/neo/sales-invoice/header/{id}/action/posted",
      "method": "POST",
      "url": "/sws/neo/sales-invoice/header/{id}/action/posted",
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
      "provenance": "extracted"
    },
    {
      "name": "aPRMProcessinvoice",
      "label": "Process Invoices",
      "actionType": "paymentAction",
      "entity": "header",
      "column": "EM_APRM_Processinvoice",
      "requiresRecord": true,
      "endpoint": "/sws/neo/sales-invoice/header/{id}/action/aPRMProcessinvoice",
      "method": "POST",
      "url": "/sws/neo/sales-invoice/header/{id}/action/aPRMProcessinvoice",
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
      "processId": "B54318B49E984B9CB855AEFB1F474CD6",
      "processType": "classic"
    },
    {
      "name": "documentAction",
      "label": "Process Invoice",
      "actionType": "documentAction",
      "entity": "header",
      "column": "DocAction",
      "requiresRecord": true,
      "endpoint": "/sws/neo/sales-invoice/header/{id}/action/documentAction",
      "method": "POST",
      "url": "/sws/neo/sales-invoice/header/{id}/action/documentAction",
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
      "processId": "111",
      "processType": "classic"
    },
    {
      "name": "createLinesFromOrder",
      "label": "Create Lines From Order",
      "actionType": "createFrom",
      "entity": "header",
      "column": "Createfromorders",
      "requiresRecord": true,
      "endpoint": "/sws/neo/sales-invoice/header/{id}/action/createLinesFromOrder",
      "method": "POST",
      "url": "/sws/neo/sales-invoice/header/{id}/action/createLinesFromOrder",
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
      "processId": "AB2EFCAABB7B4EC0A9B30CFB82963FB6",
      "processType": "obuiapp"
    },
    {
      "name": "createLinesFromShipment",
      "label": "Create Lines From Shipment",
      "actionType": "createFrom",
      "entity": "header",
      "column": "Createfrominouts",
      "requiresRecord": true,
      "endpoint": "/sws/neo/sales-invoice/header/{id}/action/createLinesFromShipment",
      "method": "POST",
      "url": "/sws/neo/sales-invoice/header/{id}/action/createLinesFromShipment",
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
      "processId": "7737CA7330FD49FBA7EBC225E85F2BC9",
      "processType": "obuiapp"
    },
    {
      "name": "copyFrom",
      "label": "Copy Lines",
      "actionType": "createFrom",
      "entity": "header",
      "column": "CopyFrom",
      "requiresRecord": true,
      "endpoint": "/sws/neo/sales-invoice/header/{id}/action/copyFrom",
      "method": "POST",
      "url": "/sws/neo/sales-invoice/header/{id}/action/copyFrom",
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
      "processId": "210",
      "processType": "classic"
    },
    {
      "name": "calculatePromotions",
      "label": "Calculate Promotions",
      "actionType": "utilityAction",
      "entity": "header",
      "column": "Calculate_Promotions",
      "requiresRecord": true,
      "endpoint": "/sws/neo/sales-invoice/header/{id}/action/calculatePromotions",
      "method": "POST",
      "url": "/sws/neo/sales-invoice/header/{id}/action/calculatePromotions",
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
      "name": "tBAIQRcode",
      "label": "Imprimir factura con QR",
      "actionType": "utilityAction",
      "entity": "header",
      "column": "em_tbai_qrcode",
      "requiresRecord": true,
      "endpoint": "/sws/neo/sales-invoice/header/{id}/action/tBAIQRcode",
      "method": "POST",
      "url": "/sws/neo/sales-invoice/header/{id}/action/tBAIQRcode",
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
      "processId": "12FECC9DF1F4418AB7DAA46D6A05FEC6",
      "processType": "obuiapp"
    },
    {
      "name": "etvfacRectCreate",
      "label": "Crear Rectificación Importe Negativo",
      "actionType": "createFrom",
      "entity": "header",
      "column": "EM_Etvfac_Rect_Create",
      "requiresRecord": true,
      "endpoint": "/sws/neo/sales-invoice/header/{id}/action/etvfacRectCreate",
      "method": "POST",
      "url": "/sws/neo/sales-invoice/header/{id}/action/etvfacRectCreate",
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
      "processId": "E36A8BA259164E78AFDDC760172C18F5",
      "processType": "obuiapp"
    },
    {
      "name": "tbaiXmlgenerator",
      "label": "Registrar Factura en TBAI",
      "actionType": "utilityAction",
      "entity": "header",
      "column": "EM_Tbai_Xmlgenerator",
      "requiresRecord": true,
      "endpoint": "/sws/neo/sales-invoice/header/{id}/action/tbaiXmlgenerator",
      "method": "POST",
      "url": "/sws/neo/sales-invoice/header/{id}/action/tbaiXmlgenerator",
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
      "processId": "BE2486102F2C41779B760609FD69A225",
      "processType": "obuiapp"
    },
    {
      "name": "tbaiVoidxmlgenerator",
      "label": "Enviar anulación a TIcketbai",
      "actionType": "documentAction",
      "entity": "header",
      "column": "EM_Tbai_Voidxmlgenerator",
      "requiresRecord": true,
      "endpoint": "/sws/neo/sales-invoice/header/{id}/action/tbaiVoidxmlgenerator",
      "method": "POST",
      "url": "/sws/neo/sales-invoice/header/{id}/action/tbaiVoidxmlgenerator",
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
      "processId": "535A8BAE44A34759A7C8FF40D62A5070",
      "processType": "obuiapp"
    },
    {
      "name": "aeatsiiSend",
      "label": "Send to SII",
      "actionType": "createFrom",
      "entity": "header",
      "column": "EM_Aeatsii_Send",
      "requiresRecord": true,
      "endpoint": "/sws/neo/sales-invoice/header/{id}/action/aeatsiiSend",
      "method": "POST",
      "url": "/sws/neo/sales-invoice/header/{id}/action/aeatsiiSend",
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
      "processId": "2ECF46DAAEEB486EAF79D3594D50DE5F",
      "processType": "obuiapp"
    },
    {
      "name": "aeatsiiModif",
      "label": "Modification in SII",
      "actionType": "utilityAction",
      "entity": "header",
      "column": "EM_Aeatsii_Modif",
      "requiresRecord": true,
      "endpoint": "/sws/neo/sales-invoice/header/{id}/action/aeatsiiModif",
      "method": "POST",
      "url": "/sws/neo/sales-invoice/header/{id}/action/aeatsiiModif",
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
      "processId": "BAAECFDF9FF144E8A610E9F1EF3E5FBE",
      "processType": "obuiapp"
    },
    {
      "name": "processNow",
      "label": "Process Invoice",
      "actionType": "documentAction",
      "entity": "header",
      "column": "Processing",
      "requiresRecord": true,
      "endpoint": "/sws/neo/sales-invoice/header/{id}/action/processNow",
      "method": "POST",
      "url": "/sws/neo/sales-invoice/header/{id}/action/processNow",
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
      "processId": "111",
      "processType": "classic"
    },
    {
      "name": "generateTo",
      "label": "Generate Receipt from Invoice",
      "actionType": "createFrom",
      "entity": "header",
      "column": "GenerateTo",
      "requiresRecord": true,
      "endpoint": "/sws/neo/sales-invoice/header/{id}/action/generateTo",
      "method": "POST",
      "url": "/sws/neo/sales-invoice/header/{id}/action/generateTo",
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
      "processId": "142",
      "processType": "classic"
    },
    {
      "name": "createLinesFrom",
      "label": "CreateFrom",
      "actionType": "createFrom",
      "entity": "header",
      "column": "CreateFrom",
      "requiresRecord": true,
      "endpoint": "/sws/neo/sales-invoice/header/{id}/action/createLinesFrom",
      "method": "POST",
      "url": "/sws/neo/sales-invoice/header/{id}/action/createLinesFrom",
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
      "name": "aeatsiiDup",
      "label": "EM_Aeatsii_Dup",
      "actionType": "utilityAction",
      "entity": "header",
      "column": "EM_Aeatsii_Dup",
      "requiresRecord": true,
      "endpoint": "/sws/neo/sales-invoice/header/{id}/action/aeatsiiDup",
      "method": "POST",
      "url": "/sws/neo/sales-invoice/header/{id}/action/aeatsiiDup",
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
      "processId": "92C02F9A367140C085D1EE3BD27C4E96",
      "processType": "obuiapp"
    },
    {
      "name": "aeatsiiUnsubscribe",
      "label": "EM_Aeatsii_Unsubscribe",
      "actionType": "utilityAction",
      "entity": "header",
      "column": "EM_Aeatsii_Unsubscribe",
      "requiresRecord": true,
      "endpoint": "/sws/neo/sales-invoice/header/{id}/action/aeatsiiUnsubscribe",
      "method": "POST",
      "url": "/sws/neo/sales-invoice/header/{id}/action/aeatsiiUnsubscribe",
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
      "processId": "BE564945CB2D4892AC0EE51204C5DB7D",
      "processType": "obuiapp"
    },
    {
      "name": "explode",
      "label": "Explode",
      "actionType": "utilityAction",
      "entity": "lines",
      "column": "Explode",
      "requiresRecord": true,
      "endpoint": "/sws/neo/sales-invoice/lines/{id}/action/explode",
      "method": "POST",
      "url": "/sws/neo/sales-invoice/lines/{id}/action/explode",
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
      "processId": "6E1ADD5C8B6B4ACB82237DAA8114451E",
      "processType": "classic"
    },
    {
      "name": "matchLCCosts",
      "label": "Match_Lccosts",
      "actionType": "utilityAction",
      "entity": "lines",
      "column": "Match_Lccosts",
      "requiresRecord": true,
      "endpoint": "/sws/neo/sales-invoice/lines/{id}/action/matchLCCosts",
      "method": "POST",
      "url": "/sws/neo/sales-invoice/lines/{id}/action/matchLCCosts",
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
      "processId": "281FFDFAB31C4394A2EAA73A6F9F3A3F",
      "processType": "obuiapp"
    },
    {
      "name": "updatePaymentPlan",
      "label": "Update Payment Plan",
      "actionType": "paymentAction",
      "entity": "paymentPlan",
      "column": "Update_Payment_Plan",
      "requiresRecord": true,
      "endpoint": "/sws/neo/sales-invoice/paymentPlan/{id}/action/updatePaymentPlan",
      "method": "POST",
      "url": "/sws/neo/sales-invoice/paymentPlan/{id}/action/updatePaymentPlan",
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
    },
    {
      "name": "aprmModifPaymentINPlan",
      "label": "Modify Payment Plan",
      "actionType": "paymentAction",
      "entity": "paymentPlan",
      "column": "EM_Aprm_Modif_Paym_Sched",
      "requiresRecord": true,
      "endpoint": "/sws/neo/sales-invoice/paymentPlan/{id}/action/aprmModifPaymentINPlan",
      "method": "POST",
      "url": "/sws/neo/sales-invoice/paymentPlan/{id}/action/aprmModifPaymentINPlan",
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
      "processId": "4EEB3497082C4F2182E16A4371CD5D96",
      "processType": "obuiapp"
    },
    {
      "name": "aprmModifPaymentOUTPlan",
      "label": "EM_Aprm_Modif_Paym_Out_Sched",
      "actionType": "paymentAction",
      "entity": "paymentPlan",
      "column": "EM_Aprm_Modif_Paym_Out_Sched",
      "requiresRecord": true,
      "endpoint": "/sws/neo/sales-invoice/paymentPlan/{id}/action/aprmModifPaymentOUTPlan",
      "method": "POST",
      "url": "/sws/neo/sales-invoice/paymentPlan/{id}/action/aprmModifPaymentOUTPlan",
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
      "processId": "6F87442DF7BC43AB8A666BDED2F7D64E",
      "processType": "obuiapp"
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
    "category": "sales"
  },
  "labelOverrides": {
    "es_ES": {
      "OutstandingAmt": "Pendiente de pago",
      "EM_Etgo_Due_Date": "Vencimiento",
      "em_etgo_delivery_status": "Estado de entrega"
    },
    "en_US": {
      "OutstandingAmt": "Pending Payment",
      "EM_Etgo_Due_Date": "Due Date",
      "em_etgo_delivery_status": "Delivery Status"
    }
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
        hideDeleteWhenComplete
        hidePrint
        noHeaderBorder
        notesField="description"
        customTabs={[{ key: 'related', label: 'Related Documents', Component: RelatedDocuments }, { key: 'attachments', labelKey: 'attachments', Component: AttachmentsTab, placement: 'tab', props: { tableName: "C_Invoice", config: {} } }]}
        bottomSection={InvoiceBottomPanel}
        topbarRight={InvoiceTopbarExtra}
        menuActions={({ status }) => [
          { key: 'reactivate', label: 'Reactivate', visible: status === 'CO', labelKey: 'reactivate', successKey: 'reactivated', documentAction: 'RE',  }
        ]}
        draftMode={draftMode}
        requiredHeaderFields={requiredHeaderFields}
        salesTheme
        labelOverrides={labelOverrides}
        lineConfig={INVOICE_LINE_CONFIG}
        linesLayout="inlineEditable"
        sendDocument
        {...props}
      />
    );
  }

  return (
    <ListView
      entity="header"
      Table={HeaderTable}
      entityLabel="Sales Invoice"
      windowName={windowName}
      breadcrumb={breadcrumb}
      api={api}
      dateFilterKey="invoiceDate"
      hidePrint
      labelOverrides={labelOverrides}
      rowQuickActions={{}}
      sendDocument
      {...props}
    />
  );
}
// @sf-generated-end component:HeaderPage

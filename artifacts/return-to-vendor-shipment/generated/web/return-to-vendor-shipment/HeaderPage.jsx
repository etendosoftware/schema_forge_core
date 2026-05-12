import { useEffect } from 'react';
import { ListView, DetailView } from '@/components/contract-ui';
import HeaderTable from './HeaderTable';
import HeaderForm from './HeaderForm';
import LinesTable from './LinesTable';
import LinesForm from './LinesForm';
import RelatedDocuments from '../../../custom/RelatedDocuments';
import { AttachmentsTab } from '@/components/attachments';
import ReturnToVendorShipmentBottomPanel from '../../../custom/ReturnToVendorShipmentBottomPanel';
import catalogs from './mockCatalogs';


const breadcrumb = 'Purchases / Return to Vendor Shipment';


// @sf-generated-start summary:header
const summary = [

];

const statusField = 'documentStatus';
// @sf-generated-end summary:header

// @sf-generated-start extraBadges:header
const extraBadges = [];
// @sf-generated-end extraBadges:header

// @sf-generated-start processes:header
const processes = [
  { name: 'sendMaterials', label: 'Pick/Edit Lines', style: 'positive',
    displayLogicRaw: "@Processed@='N'" },
  { name: 'documentAction', label: 'Process Shipment', style: 'positive',
    displayLogicRaw: "@DocStatus@!'CL'&@DocStatus@!'VO'" },
];
// @sf-generated-end processes:header

// @sf-generated-start draftMode:header
const draftMode = null;
// @sf-generated-end draftMode:header

// @sf-generated-start requiredHeaderFields:header
const requiredHeaderFields = ['businessPartner', 'partnerAddress', 'movementDate', 'accountingDate', 'warehouse', 'documentStatus', 'documentAction'];
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
  "specName": "return-to-vendor-shipment",
  "baseUrl": "/sws/neo/return-to-vendor-shipment",
  "crud": {
    "header": {
      "get": true,
      "getById": true,
      "post": true,
      "put": true,
      "patch": true,
      "delete": true,
      "listUrl": "/sws/neo/return-to-vendor-shipment/header",
      "detailUrl": "/sws/neo/return-to-vendor-shipment/header/{id}",
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
      "listUrl": "/sws/neo/return-to-vendor-shipment/lines",
      "detailUrl": "/sws/neo/return-to-vendor-shipment/lines/{id}",
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
      "url": "/sws/neo/return-to-vendor-shipment/header/selectors/businessPartner"
    },
    {
      "entity": "header",
      "field": "partnerAddress",
      "column": "C_BPartner_Location_ID",
      "reference": "BusinessPartnerLocation",
      "inputMode": "dependent",
      "url": "/sws/neo/return-to-vendor-shipment/header/selectors/partnerAddress",
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
      "field": "warehouse",
      "column": "M_Warehouse_ID",
      "reference": "Warehouse",
      "inputMode": "selector",
      "url": "/sws/neo/return-to-vendor-shipment/header/selectors/warehouse"
    },
    {
      "entity": "header",
      "field": "project",
      "column": "C_Project_ID",
      "reference": "Project",
      "inputMode": "search",
      "url": "/sws/neo/return-to-vendor-shipment/header/selectors/project",
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
      "url": "/sws/neo/return-to-vendor-shipment/header/selectors/costcenter"
    },
    {
      "entity": "header",
      "field": "stDimension",
      "column": "User1_ID",
      "reference": "User1",
      "inputMode": "selector",
      "url": "/sws/neo/return-to-vendor-shipment/header/selectors/stDimension"
    },
    {
      "entity": "header",
      "field": "ndDimension",
      "column": "User2_ID",
      "reference": "User2",
      "inputMode": "selector",
      "url": "/sws/neo/return-to-vendor-shipment/header/selectors/ndDimension"
    },
    {
      "entity": "lines",
      "field": "product",
      "column": "M_Product_ID",
      "reference": "Product",
      "inputMode": "search",
      "url": "/sws/neo/return-to-vendor-shipment/lines/selectors/product"
    },
    {
      "entity": "lines",
      "field": "operativeUOM",
      "column": "C_Aum",
      "reference": "UOM",
      "inputMode": "search",
      "url": "/sws/neo/return-to-vendor-shipment/lines/selectors/operativeUOM",
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
      "url": "/sws/neo/return-to-vendor-shipment/lines/selectors/uOM"
    },
    {
      "entity": "lines",
      "field": "storageBin",
      "column": "M_Locator_ID",
      "reference": "Locator",
      "inputMode": "selector",
      "url": "/sws/neo/return-to-vendor-shipment/lines/selectors/storageBin"
    },
    {
      "entity": "lines",
      "field": "salesOrderLine",
      "column": "C_OrderLine_ID",
      "reference": "OrderLine",
      "inputMode": "search",
      "url": "/sws/neo/return-to-vendor-shipment/lines/selectors/salesOrderLine"
    },
    {
      "entity": "lines",
      "field": "project",
      "column": "C_Project_ID",
      "reference": "Project",
      "inputMode": "search",
      "url": "/sws/neo/return-to-vendor-shipment/lines/selectors/project"
    },
    {
      "entity": "lines",
      "field": "costcenter",
      "column": "C_Costcenter_ID",
      "reference": "Costcenter",
      "inputMode": "selector",
      "url": "/sws/neo/return-to-vendor-shipment/lines/selectors/costcenter"
    },
    {
      "entity": "lines",
      "field": "stDimension",
      "column": "User1_ID",
      "reference": "User1",
      "inputMode": "selector",
      "url": "/sws/neo/return-to-vendor-shipment/lines/selectors/stDimension"
    },
    {
      "entity": "lines",
      "field": "ndDimension",
      "column": "User2_ID",
      "reference": "User2",
      "inputMode": "selector",
      "url": "/sws/neo/return-to-vendor-shipment/lines/selectors/ndDimension"
    }
  ],
  "actions": [
    {
      "name": "sendMaterials",
      "label": "Pick/Edit Lines",
      "actionType": "createFrom",
      "entity": "header",
      "column": "RM_Shipment_Pickedit",
      "requiresRecord": true,
      "endpoint": "/sws/neo/return-to-vendor-shipment/header/{id}/action/sendMaterials",
      "method": "POST",
      "url": "/sws/neo/return-to-vendor-shipment/header/{id}/action/sendMaterials",
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
      "processId": "4AD70293357245AB96E59C2CDB43A35D",
      "processType": "obuiapp"
    },
    {
      "name": "createLinesFrom",
      "label": "Create Lines From",
      "actionType": "createFrom",
      "entity": "header",
      "column": "CreateFrom",
      "requiresRecord": true,
      "endpoint": "/sws/neo/return-to-vendor-shipment/header/{id}/action/createLinesFrom",
      "method": "POST",
      "url": "/sws/neo/return-to-vendor-shipment/header/{id}/action/createLinesFrom",
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
      "name": "generateTo",
      "label": "Generate Invoice from Receipt",
      "actionType": "createFrom",
      "entity": "header",
      "column": "GenerateTo",
      "requiresRecord": true,
      "endpoint": "/sws/neo/return-to-vendor-shipment/header/{id}/action/generateTo",
      "method": "POST",
      "url": "/sws/neo/return-to-vendor-shipment/header/{id}/action/generateTo",
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
      "processId": "154",
      "processType": "classic"
    },
    {
      "name": "documentAction",
      "label": "Process Shipment",
      "actionType": "documentAction",
      "entity": "header",
      "column": "DocAction",
      "requiresRecord": true,
      "endpoint": "/sws/neo/return-to-vendor-shipment/header/{id}/action/documentAction",
      "method": "POST",
      "url": "/sws/neo/return-to-vendor-shipment/header/{id}/action/documentAction",
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
      "processId": "109",
      "processType": "classic"
    },
    {
      "name": "posted",
      "label": "Posted",
      "actionType": "documentAction",
      "entity": "header",
      "column": "Posted",
      "requiresRecord": true,
      "endpoint": "/sws/neo/return-to-vendor-shipment/header/{id}/action/posted",
      "method": "POST",
      "url": "/sws/neo/return-to-vendor-shipment/header/{id}/action/posted",
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
      "name": "calculateFreight",
      "label": "Calculate Freight Amount",
      "actionType": "utilityAction",
      "entity": "header",
      "column": "Calculate_Freight",
      "requiresRecord": true,
      "endpoint": "/sws/neo/return-to-vendor-shipment/header/{id}/action/calculateFreight",
      "method": "POST",
      "url": "/sws/neo/return-to-vendor-shipment/header/{id}/action/calculateFreight",
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
      "processId": "800141",
      "processType": "classic"
    },
    {
      "name": "receiveMaterials",
      "label": "Receive Materials",
      "actionType": "createFrom",
      "entity": "header",
      "column": "RM_Receipt_PickEdit",
      "requiresRecord": true,
      "endpoint": "/sws/neo/return-to-vendor-shipment/header/{id}/action/receiveMaterials",
      "method": "POST",
      "url": "/sws/neo/return-to-vendor-shipment/header/{id}/action/receiveMaterials",
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
      "processId": "5E9F9D7EECC24E4FBB2C60840FF613BE",
      "processType": "obuiapp"
    },
    {
      "name": "updateLines",
      "label": "Update Attributes from Shipment",
      "actionType": "utilityAction",
      "entity": "header",
      "column": "UpdateLines",
      "requiresRecord": true,
      "endpoint": "/sws/neo/return-to-vendor-shipment/header/{id}/action/updateLines",
      "method": "POST",
      "url": "/sws/neo/return-to-vendor-shipment/header/{id}/action/updateLines",
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
      "processId": "800010",
      "processType": "classic"
    },
    {
      "name": "invoicefromshipment",
      "label": "Invoicefromshipment",
      "actionType": "utilityAction",
      "entity": "header",
      "column": "Invoicefromshipment",
      "requiresRecord": true,
      "endpoint": "/sws/neo/return-to-vendor-shipment/header/{id}/action/invoicefromshipment",
      "method": "POST",
      "url": "/sws/neo/return-to-vendor-shipment/header/{id}/action/invoicefromshipment",
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
      "processId": "62250E8866EA4D96A66C309878DC039E",
      "processType": "obuiapp"
    },
    {
      "name": "processGoodsJava",
      "label": "Process_Goods_Java",
      "actionType": "utilityAction",
      "entity": "header",
      "column": "Process_Goods_Java",
      "requiresRecord": true,
      "endpoint": "/sws/neo/return-to-vendor-shipment/header/{id}/action/processGoodsJava",
      "method": "POST",
      "url": "/sws/neo/return-to-vendor-shipment/header/{id}/action/processGoodsJava",
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
      "processId": "49DEE812BF0545269781FCEBF2235924",
      "processType": "classic"
    },
    {
      "name": "explode",
      "label": "Explode",
      "actionType": "utilityAction",
      "entity": "lines",
      "column": "Explode",
      "requiresRecord": true,
      "endpoint": "/sws/neo/return-to-vendor-shipment/lines/{id}/action/explode",
      "method": "POST",
      "url": "/sws/neo/return-to-vendor-shipment/lines/{id}/action/explode",
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
      "processId": "DAE719940FE9463F8A3E3C401BBAFC53",
      "processType": "classic"
    },
    {
      "name": "managePrereservation",
      "label": "Manage_Prereservation",
      "actionType": "utilityAction",
      "entity": "lines",
      "column": "Manage_Prereservation",
      "requiresRecord": true,
      "endpoint": "/sws/neo/return-to-vendor-shipment/lines/{id}/action/managePrereservation",
      "method": "POST",
      "url": "/sws/neo/return-to-vendor-shipment/lines/{id}/action/managePrereservation",
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
        notesField="description"
        customTabs={[{ key: 'related', label: 'Related Documents', Component: RelatedDocuments }, { key: 'attachments', labelKey: 'attachments', Component: AttachmentsTab, placement: 'tab', props: { tableName: "M_InOut", config: {} } }]}
        bottomSection={ReturnToVendorShipmentBottomPanel}
        requiredHeaderFields={requiredHeaderFields}
        linesLayout="inlineEditable"
        {...props}
      />
    );
  }

  return (
    <ListView
      entity="header"
      Table={HeaderTable}
      entityLabel="Return to Vendor Shipment"
      windowName={windowName}
      breadcrumb={breadcrumb}
      api={api}
      dateFilterKey="movementDate"
      rowQuickActions={{}}
      {...props}
    />
  );
}
// @sf-generated-end component:HeaderPage

import { useEffect } from 'react';
import { ListView, DetailView } from '@/components/contract-ui';
import InventoryTable from './InventoryTable';
import InventoryForm from './InventoryForm';
import InventoryLineTable from './InventoryLineTable';
import InventoryLineForm from './InventoryLineForm';
import { AttachmentsTab } from '@/components/attachments';
import PhysicalInventoryBottomPanel from '../../../custom/PhysicalInventoryBottomPanel';
import InventoryMenuContent from '../../../custom/InventoryMenuContent';
import catalogs from './mockCatalogs';


const breadcrumb = 'Inventory / Physical Inventory';


// @sf-generated-start summary:inventory
const summary = [
  { key: 'inventoryType', column: 'Inventory_Type', type: 'enum' },
];

const statusField = 'processed';
// @sf-generated-end summary:inventory

// @sf-generated-start extraBadges:inventory
const extraBadges = [];
// @sf-generated-end extraBadges:inventory

// @sf-generated-start processes:inventory
const processes = [
  { name: 'processNow', label: 'Process Inventory Count', style: 'positive',
    displayLogicRaw: "@Processed@='N'", requiresLines: true },
];
// @sf-generated-end processes:inventory

// @sf-generated-start draftMode:inventory
const draftMode = null;
// @sf-generated-end draftMode:inventory

// @sf-generated-start requiredHeaderFields:inventory
const requiredHeaderFields = ['movementDate', 'name', 'warehouse', 'inventoryType'];
// @sf-generated-end requiredHeaderFields:inventory

// @sf-generated-start addLineFields:inventoryLine
const addLineFields = {
  entry: [
    { key: 'lineNo', column: 'Line', type: 'number', label: 'Line No.', defaultValue: '@SQL=SELECT COALESCE(MAX(Line),0)+10 AS DefaultValue FROM M_InventoryLine WHERE M_Inventory_ID=@M_Inventory_ID@' },
    { key: 'product', column: 'M_Product_ID', type: 'search', required: true, lookup: true, label: 'Product', reference: 'Product', inputMode: 'search', forceCalloutFields: ["quantityCount","bookQuantity"] },
    { key: 'description', column: 'Description', type: 'textarea', label: 'Description' },
    { key: 'quantityCount', column: 'QtyCount', type: 'number', required: true, label: 'User Count' },
  ],
  derived: [
    { key: 'cost', column: 'Cost', type: 'number', label: 'Cost' },
  ],
  hidden: [

  ],
};
// @sf-generated-end addLineFields:inventoryLine

export const api = {
  "specName": "physical-inventory",
  "baseUrl": "/sws/neo/physical-inventory",
  "crud": {
    "inventory": {
      "get": true,
      "getById": true,
      "post": true,
      "put": true,
      "patch": true,
      "delete": true,
      "listUrl": "/sws/neo/physical-inventory/inventory",
      "detailUrl": "/sws/neo/physical-inventory/inventory/{id}",
      "supportedFilters": [
        "movementDate",
        "warehouse",
        "inventoryType"
      ]
    },
    "inventoryLine": {
      "get": true,
      "getById": true,
      "post": true,
      "put": true,
      "patch": true,
      "delete": true,
      "listUrl": "/sws/neo/physical-inventory/inventoryLine",
      "detailUrl": "/sws/neo/physical-inventory/inventoryLine/{id}",
      "supportedFilters": []
    }
  },
  "selectors": [
    {
      "entity": "inventory",
      "field": "warehouse",
      "column": "M_Warehouse_ID",
      "reference": "Warehouse",
      "inputMode": "search",
      "url": "/sws/neo/physical-inventory/inventory/selectors/warehouse"
    },
    {
      "entity": "inventory",
      "field": "project",
      "column": "C_Project_ID",
      "reference": "Project",
      "inputMode": "search",
      "url": "/sws/neo/physical-inventory/inventory/selectors/project"
    },
    {
      "entity": "inventoryLine",
      "field": "product",
      "column": "M_Product_ID",
      "reference": "Product",
      "inputMode": "search",
      "url": "/sws/neo/physical-inventory/inventoryLine/selectors/product"
    },
    {
      "entity": "inventoryLine",
      "field": "storageBin",
      "column": "M_Locator_ID",
      "reference": "Locator",
      "inputMode": "search",
      "url": "/sws/neo/physical-inventory/inventoryLine/selectors/storageBin"
    },
    {
      "entity": "inventoryLine",
      "field": "uOM",
      "column": "C_UOM_ID",
      "reference": "UOM",
      "inputMode": "selector",
      "url": "/sws/neo/physical-inventory/inventoryLine/selectors/uOM"
    }
  ],
  "actions": [
    {
      "name": "generateList",
      "label": "Create Inventory Count List",
      "actionType": "createFrom",
      "entity": "inventory",
      "column": "GenerateList",
      "requiresRecord": true,
      "endpoint": "/sws/neo/physical-inventory/inventory/{id}/action/generateList",
      "method": "POST",
      "url": "/sws/neo/physical-inventory/inventory/{id}/action/generateList",
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
      "processId": "105",
      "processType": "classic"
    },
    {
      "name": "updateQuantities",
      "label": "Update Quantity",
      "actionType": "utilityAction",
      "entity": "inventory",
      "column": "UpdateQty",
      "requiresRecord": true,
      "endpoint": "/sws/neo/physical-inventory/inventory/{id}/action/updateQuantities",
      "method": "POST",
      "url": "/sws/neo/physical-inventory/inventory/{id}/action/updateQuantities",
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
      "processId": "106",
      "processType": "classic"
    },
    {
      "name": "processNow",
      "label": "Process Inventory Count",
      "actionType": "documentAction",
      "entity": "inventory",
      "column": "Processing",
      "requiresRecord": true,
      "endpoint": "/sws/neo/physical-inventory/inventory/{id}/action/processNow",
      "method": "POST",
      "url": "/sws/neo/physical-inventory/inventory/{id}/action/processNow",
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
      "processId": "107",
      "processType": "classic"
    },
    {
      "name": "posted",
      "label": "Posted",
      "actionType": "documentAction",
      "entity": "inventory",
      "column": "Posted",
      "requiresRecord": true,
      "endpoint": "/sws/neo/physical-inventory/inventory/{id}/action/posted",
      "method": "POST",
      "url": "/sws/neo/physical-inventory/inventory/{id}/action/posted",
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
    "category": "inventory"
  }
};

// @sf-generated-start component:InventoryPage
export default function InventoryPage({ windowName, recordId, ...props }) {
  if (recordId) {
    return (
      <DetailView
        entity="inventory"
        detailEntity="inventoryLine"
        Form={InventoryForm}
        DetailTable={InventoryLineTable}
        DetailForm={InventoryLineForm}
        summary={summary}
        statusField={statusField}
        extraBadges={extraBadges}
        processes={processes}
        addLineFields={addLineFields}
        catalogs={catalogs}
        entityLabel="Inventory"
        detailLabel="Lines"
        windowName={windowName}
        recordId={recordId}
        breadcrumb={breadcrumb}
      api={api}
        customTabs={[{ key: 'attachments', labelKey: 'attachments', Component: AttachmentsTab, placement: 'tab', props: { tableName: "M_Inventory", config: {} } }]}
        bottomSection={PhysicalInventoryBottomPanel}
        customMenuContent={InventoryMenuContent}
        requiredHeaderFields={requiredHeaderFields}
        linesLayout="inlineEditable"
        {...props}
      />
    );
  }

  return (
    <ListView
      entity="inventory"
      Table={InventoryTable}
      entityLabel="Physical Inventory"
      windowName={windowName}
      breadcrumb={breadcrumb}
      api={api}
      dateFilterKey="movementDate"
      rowQuickActions={{}}
      {...props}
    />
  );
}
// @sf-generated-end component:InventoryPage

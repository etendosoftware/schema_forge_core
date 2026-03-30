import { ListView, DetailView } from '@/components/contract-ui';
import AAssetTable from './AAssetTable';
import AAssetForm from './AAssetForm';
import AmortizationLineTable from './AmortizationLineTable';
import AmortizationLineForm from './AmortizationLineForm';
import catalogs from './mockCatalogs';


const breadcrumb = 'Accounting / Assets';

// @sf-generated-start summary:aAsset
const summary = [
  { key: 'documentNo', column: 'DocumentNo', type: 'string' },
  { key: 'depreciatedValue', column: 'Depreciatedvalue', type: 'amount' },
  { key: 'depreciatedPlan', column: 'Depreciatedplan', type: 'amount' },
  { key: 'fullyDepreciated', column: 'IsFullyDepreciated', type: 'boolean' },
];

const statusField = null;
// @sf-generated-end summary:aAsset

// @sf-custom-slot extraBadges:aAsset
// @sf-generated-start extraBadges:aAsset
const extraBadges = [];
// @sf-generated-end extraBadges:aAsset

// @sf-generated-start processes:aAsset
const processes = [
  { name: 'processed', label: 'Create Amortization', style: 'positive', displayLogicRaw: '@IsDepreciated@=\'Y\'' },
  { name: 'processAsset', label: 'Generate Amortization Plan', style: 'positive', displayLogicRaw: '@IsDepreciated@=\'Y\'' },
];
// @sf-generated-end processes:aAsset

// @sf-generated-start draftMode:aAsset
const draftMode = null;
// @sf-generated-end draftMode:aAsset

// @sf-generated-start addLineFields:amortizationLine
const addLineFields = {
  entry: [
    { key: 'amortizationPercentage', column: 'Amortization_Percentage', type: 'text', label: 'Amortization Percentage' },
    { key: 'currency', column: 'C_Currency_ID', type: 'selector', label: 'Currency', reference: 'Currency', inputMode: 'selector' },
  ],
  derived: [
    { key: 'amortizationAmount', column: 'Amortizationamt', type: 'number', label: 'Amortization Amount' },
  ],
  hidden: [

  ],
};
// @sf-generated-end addLineFields:amortizationLine

const api = {
  "specName": "assets",
  "baseUrl": "/sws/neo/assets",
  "crud": {
    "aAsset": {
      "get": true,
      "getById": true,
      "post": true,
      "put": true,
      "patch": true,
      "delete": true,
      "listUrl": "/sws/neo/assets/aAsset",
      "detailUrl": "/sws/neo/assets/aAsset/{id}",
      "supportedFilters": [
        "searchKey",
        "name",
        "assetCategory",
        "depreciate",
        "fullyDepreciated"
      ]
    },
    "amortizationLine": {
      "get": true,
      "getById": true,
      "post": true,
      "put": true,
      "patch": true,
      "delete": true,
      "listUrl": "/sws/neo/assets/amortizationLine",
      "detailUrl": "/sws/neo/assets/amortizationLine/{id}",
      "supportedFilters": []
    },
    "assetAcct": {
      "get": true,
      "getById": true,
      "post": true,
      "put": true,
      "patch": true,
      "delete": true,
      "listUrl": "/sws/neo/assets/assetAcct",
      "detailUrl": "/sws/neo/assets/assetAcct/{id}",
      "supportedFilters": []
    }
  },
  "selectors": [
    {
      "entity": "aAsset",
      "field": "assetCategory",
      "column": "A_Asset_Group_ID",
      "reference": "AssetGroup",
      "inputMode": "selector",
      "url": "/sws/neo/assets/aAsset/selectors/assetCategory"
    },
    {
      "entity": "aAsset",
      "field": "currency",
      "column": "C_Currency_ID",
      "reference": "Currency",
      "inputMode": "selector",
      "url": "/sws/neo/assets/aAsset/selectors/currency"
    },
    {
      "entity": "aAsset",
      "field": "product",
      "column": "M_Product_ID",
      "reference": "Product",
      "inputMode": "search",
      "url": "/sws/neo/assets/aAsset/selectors/product"
    },
    {
      "entity": "aAsset",
      "field": "project",
      "column": "C_Project_ID",
      "reference": "Project",
      "inputMode": "search",
      "url": "/sws/neo/assets/aAsset/selectors/project"
    },
    {
      "entity": "amortizationLine",
      "field": "amortization",
      "column": "A_Amortization_ID",
      "reference": "Amortization",
      "inputMode": "search",
      "url": "/sws/neo/assets/amortizationLine/selectors/amortization"
    },
    {
      "entity": "amortizationLine",
      "field": "currency",
      "column": "C_Currency_ID",
      "reference": "Currency",
      "inputMode": "selector",
      "url": "/sws/neo/assets/amortizationLine/selectors/currency"
    },
    {
      "entity": "assetAcct",
      "field": "accountingSchema",
      "column": "C_AcctSchema_ID",
      "reference": "AcctSchema",
      "inputMode": "selector",
      "url": "/sws/neo/assets/assetAcct/selectors/accountingSchema"
    },
    {
      "entity": "assetAcct",
      "field": "accumulatedDepreciation",
      "column": "A_Accumdepreciation_Acct",
      "reference": "ValidCombination",
      "inputMode": "selector",
      "url": "/sws/neo/assets/assetAcct/selectors/accumulatedDepreciation"
    },
    {
      "entity": "assetAcct",
      "field": "depreciation",
      "column": "A_Depreciation_Acct",
      "reference": "ValidCombination",
      "inputMode": "selector",
      "url": "/sws/neo/assets/assetAcct/selectors/depreciation"
    }
  ],
  "actions": [
    {
      "entity": "aAsset",
      "field": "processed",
      "column": "Processed",
      "url": "/sws/neo/assets/aAsset/{id}/action/processed"
    },
    {
      "entity": "aAsset",
      "field": "processAsset",
      "column": "Process_Asset",
      "url": "/sws/neo/assets/aAsset/{id}/action/processAsset"
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
      "example": "_sortBy=assetsDate"
    },
    "filtering": "Use field name as query param: ?fieldName=value",
    "parentFilter": "parentId={id} for child entities"
  }
};

// @sf-generated-start component:AAssetPage
export default function AAssetPage({ windowName, recordId, ...props }) {
  // @sf-custom-slot hooks:AAssetPage
  if (recordId) {
    return (
      <DetailView
        entity="aAsset"
        detailEntity="amortizationLine"
        Form={AAssetForm}
        DetailTable={AmortizationLineTable}
        DetailForm={AmortizationLineForm}
        summary={summary}
        statusField={statusField}
        extraBadges={extraBadges}
        processes={processes}
        addLineFields={addLineFields}
        catalogs={catalogs}
        entityLabel="A Asset"
        detailLabel="Asset Amortization"
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
      entity="aAsset"
      Table={AAssetTable}
      entityLabel="A Assets"
      windowName={windowName}
      breadcrumb={breadcrumb}
      api={api}
      {...props}
    />
  );
}
// @sf-generated-end component:AAssetPage

// @sf-custom-slot section:AAssetPage-custom

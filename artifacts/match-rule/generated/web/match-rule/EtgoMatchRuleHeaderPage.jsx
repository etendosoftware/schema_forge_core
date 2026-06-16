import { ListModalWindow } from '@/components/contract-ui';

// @sf-generated-start columns:etgoMatchRuleHeader
const columns = [
  { key: 'priority', column: 'Priority', type: 'number', label: 'Priority', labelKey: 'matchRuleColPriority', inlineEdit: true, cellType: 'priorityPill' },
  { key: 'name', column: 'Name', type: 'string', label: 'Name', labelKey: 'matchRuleColName', cellType: 'nameWithSubline', subField: 'businessPartner' },
  { key: 'textCondition', column: 'TextCondition', type: 'enum', label: 'Text Condition', labelKey: 'matchRuleColCondition', enumLabels: { 'C': 'Contains', 'R': 'Regex', 'S': 'Starts with' }, cellType: 'conditionChip', kindField: 'textCondition', patternField: 'textPattern', kindLabels: {"C":"matchRuleConditionContains","S":"matchRuleConditionStartsWith","R":"matchRuleConditionRegex"} },
  { key: 'transactionType', column: 'TransactionType', type: 'enum', label: 'Transaction Type', labelKey: 'matchRuleColType', enumLabels: { 'B': 'Bank fee', 'H': 'Tax retention', 'T': 'Transfer' }, cellType: 'typePill', tones: {"H":"blue","T":"neutral","B":"amber","R":"green","O":"neutral"} },
  { key: 'accountingConcept', column: 'C_GLItem_ID', type: 'selector', label: 'C_GLItem_ID', labelKey: 'matchRuleColConcept' },
  { key: 'matchCount', column: 'MatchCount', type: 'number', label: 'Match Count', labelKey: 'matchRuleColReconciliations', cellType: 'boldText' },
  { key: 'active', column: 'Isactive', type: 'boolean', label: 'Active', labelKey: 'matchRuleColActive', toggle: true, cellType: 'toggle' },
];
// @sf-generated-end columns:etgoMatchRuleHeader

// @sf-generated-start fields:etgoMatchRuleHeader
const fields = [
  { key: 'name', column: 'Name', type: 'text', label: 'Name', required: true, section: 'general', placeholderKey: 'matchRuleNamePlaceholder' },
  { key: 'textPattern', column: 'TextPattern', type: 'text', label: 'Text Pattern', required: true, section: 'general', placeholderKey: 'matchRulePatternPlaceholder' },
  { key: 'financialAccount', column: 'FIN_Financial_Account_ID', type: 'selector', label: 'Financial Account', reference: 'Financial_Account', inputMode: 'selector', searchSelect: true, section: 'general', emptyOptionLabelKey: 'matchRuleAllAccounts' },
  { key: 'transactionType', column: 'TransactionType', type: 'select', label: 'Transaction Type', searchSelect: true, section: 'general', options: [{ value: 'B', label: 'Bank fee' }, { value: 'H', label: 'Tax retention' }, { value: 'T', label: 'Transfer' }], placeholderKey: 'matchRuleTypePlaceholder' },
  { key: 'accountingConcept', column: 'C_GLItem_ID', type: 'selector', label: 'C_GLItem_ID', reference: 'GLItem', inputMode: 'selector', searchSelect: true, section: 'general' },
  { key: 'textCondition', column: 'TextCondition', type: 'select', label: 'Text Condition', required: true, searchSelect: true, section: 'general', options: [{ value: 'C', label: 'Contains' }, { value: 'R', label: 'Regex' }, { value: 'S', label: 'Starts with' }], placeholderKey: 'matchRuleConditionPlaceholder' },
  { key: 'priority', column: 'Priority', type: 'number', label: 'Priority', required: true, section: 'general' },
  { key: 'businessPartner', column: 'C_BPartner_ID', type: 'selector', label: 'Business Partner', reference: 'BPartner', inputMode: 'selector', searchSelect: true, section: 'general' },
  { key: 'project', column: 'C_Project_ID', type: 'selector', label: 'Project', reference: 'Project', inputMode: 'selector', searchSelect: true, section: 'dimensions' },
  { key: 'costCenter', column: 'C_Costcenter_ID', type: 'selector', label: 'Cost Center', reference: 'Costcenter', inputMode: 'selector', searchSelect: true, section: 'dimensions' },
  { key: 'user1Dimension', column: 'User1_ID', type: 'selector', label: 'User1 Dimension', reference: 'User1', inputMode: 'selector', searchSelect: true, section: 'dimensions' },
  { key: 'user2Dimension', column: 'User2_ID', type: 'selector', label: 'User2 Dimension', reference: 'User2', inputMode: 'selector', searchSelect: true, section: 'dimensions' },
  { key: 'product', column: 'M_Product_ID', type: 'selector', label: 'M_Product_ID', reference: 'Product', inputMode: 'selector', searchSelect: true, section: 'dimensions' },
];

const sections = [
  { key: 'general' },
  { key: 'dimensions', label: 'matchRuleSectionDimensions' },
];

const filters = ['name', 'textPattern'];
// @sf-generated-end fields:etgoMatchRuleHeader

const breadcrumb = 'Finance / Accounts / Match Rule';
const listModalConfig = {
  "titleKey": "matchRuleNewTitle",
  "editTitleKey": "matchRuleEditTitle",
  "subtitleKey": "matchRuleNewSubtitle",
  "editSubtitleKey": null,
  "submitLabelKey": "matchRuleSubmitCreate",
  "editSubmitLabelKey": "matchRuleSubmitSave",
  "bannerKey": "matchRuleBanner",
  "searchPlaceholderKey": "matchRuleSearchPlaceholder",
  "newLabelKey": "matchRuleNew",
  "autoPriorityField": "priority",
  "autoPriorityStep": 10,
  "identifierField": null,
  "footerToggleField": null,
  "sectionGrid": {
    "general": 3,
    "dimensions": 4
  },
  "backLabelKey": "cancel",
  "backTo": null,
  "toolbarFilters": [
    {
      "key": "active",
      "field": "active",
      "allLabelKey": "matchRuleFilterAllRules",
      "options": [
        {
          "value": "Y",
          "labelKey": "matchRuleFilterActive"
        },
        {
          "value": "N",
          "labelKey": "matchRuleFilterInactive"
        }
      ]
    }
  ]
};

export const api = {
  "specName": "match-rule",
  "baseUrl": "/sws/neo/match-rule",
  "crud": {
    "etgoMatchRuleHeader": {
      "get": true,
      "getById": true,
      "post": true,
      "put": true,
      "patch": true,
      "delete": true,
      "listUrl": "/sws/neo/match-rule/etgoMatchRuleHeader",
      "detailUrl": "/sws/neo/match-rule/etgoMatchRuleHeader/{id}",
      "supportedFilters": [
        "name",
        "textPattern"
      ]
    }
  },
  "selectors": [
    {
      "entity": "etgoMatchRuleHeader",
      "field": "businessPartner",
      "column": "C_BPartner_ID",
      "reference": "BPartner",
      "inputMode": "selector",
      "url": "/sws/neo/match-rule/etgoMatchRuleHeader/selectors/businessPartner"
    },
    {
      "entity": "etgoMatchRuleHeader",
      "field": "financialAccount",
      "column": "FIN_Financial_Account_ID",
      "reference": "Financial_Account",
      "inputMode": "selector",
      "url": "/sws/neo/match-rule/etgoMatchRuleHeader/selectors/financialAccount"
    },
    {
      "entity": "etgoMatchRuleHeader",
      "field": "project",
      "column": "C_Project_ID",
      "reference": "Project",
      "inputMode": "selector",
      "url": "/sws/neo/match-rule/etgoMatchRuleHeader/selectors/project"
    },
    {
      "entity": "etgoMatchRuleHeader",
      "field": "costCenter",
      "column": "C_Costcenter_ID",
      "reference": "Costcenter",
      "inputMode": "selector",
      "url": "/sws/neo/match-rule/etgoMatchRuleHeader/selectors/costCenter"
    },
    {
      "entity": "etgoMatchRuleHeader",
      "field": "user1Dimension",
      "column": "User1_ID",
      "reference": "User1",
      "inputMode": "selector",
      "url": "/sws/neo/match-rule/etgoMatchRuleHeader/selectors/user1Dimension"
    },
    {
      "entity": "etgoMatchRuleHeader",
      "field": "user2Dimension",
      "column": "User2_ID",
      "reference": "User2",
      "inputMode": "selector",
      "url": "/sws/neo/match-rule/etgoMatchRuleHeader/selectors/user2Dimension"
    },
    {
      "entity": "etgoMatchRuleHeader",
      "field": "accountingConcept",
      "column": "C_GLItem_ID",
      "reference": "GLItem",
      "inputMode": "selector",
      "url": "/sws/neo/match-rule/etgoMatchRuleHeader/selectors/accountingConcept"
    },
    {
      "entity": "etgoMatchRuleHeader",
      "field": "product",
      "column": "M_Product_ID",
      "reference": "Product",
      "inputMode": "selector",
      "url": "/sws/neo/match-rule/etgoMatchRuleHeader/selectors/product"
    }
  ],
  "actions": [],
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
    "category": "finance"
  },
  "labelOverrides": {
    "es_ES": {
      "Name": "Nombre",
      "Priority": "Prioridad",
      "TextCondition": "Condición sobre el concepto",
      "TextPattern": "Patrón a buscar",
      "TransactionType": "Tipo de transacción",
      "C_GLItem_ID": "Concepto contable",
      "MatchCount": "Conciliaciones",
      "Isactive": "Activa",
      "C_BPartner_ID": "Contacto",
      "FIN_Financial_Account_ID": "Afecta a",
      "C_Project_ID": "Proyecto",
      "C_Costcenter_ID": "Centro de coste",
      "M_Product_ID": "Producto",
      "User1_ID": "1ª Dimensión",
      "User2_ID": "2ª Dimensión"
    },
    "en_US": {
      "Name": "Name",
      "Priority": "Priority",
      "TextCondition": "Concept condition",
      "TextPattern": "Pattern to match",
      "TransactionType": "Transaction type",
      "C_GLItem_ID": "Accounting concept",
      "MatchCount": "Reconciliations",
      "Isactive": "Active",
      "C_BPartner_ID": "Contact",
      "FIN_Financial_Account_ID": "Applies to",
      "C_Project_ID": "Project",
      "C_Costcenter_ID": "Cost center",
      "M_Product_ID": "Product",
      "User1_ID": "1st Dimension",
      "User2_ID": "2nd Dimension"
    }
  }
};

// @sf-generated-start component:EtgoMatchRuleHeaderPage
export default function EtgoMatchRuleHeaderPage({ windowName, ...props }) {
  return (
    <ListModalWindow
      entity="etgoMatchRuleHeader"
      entityLabel="Match Rule"
      windowName={windowName}
      breadcrumb={breadcrumb}
      columns={columns}
      fields={fields}
      sections={sections}
      filters={filters}
      config={listModalConfig}
      api={api}
      {...props}
    />
  );
}
// @sf-generated-end component:EtgoMatchRuleHeaderPage

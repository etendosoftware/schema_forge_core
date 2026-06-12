import { ListModalWindow } from '@/components/contract-ui';

// @sf-generated-start columns:etgoMatchRuleHeader
const columns = [
  { key: 'priority', column: 'Priority', type: 'number', label: 'Priority', labelKey: 'matchRuleColPriority', inlineEdit: true, cellType: 'priorityPill' },
  { key: 'name', column: 'Name', type: 'string', label: 'Name', labelKey: 'matchRuleColName', cellType: 'nameWithSubline', subField: 'businessPartner' },
  { key: 'textCondition', column: 'TextCondition', type: 'enum', label: 'Text Condition', labelKey: 'matchRuleColCondition', enumLabels: { 'C': 'Contains', 'R': 'Regex', 'S': 'Starts with' }, cellType: 'conditionChip', kindField: 'textCondition', patternField: 'textPattern', kindLabels: {"C":"matchRuleConditionContains","S":"matchRuleConditionStartsWith","R":"matchRuleConditionRegex"} },
  { key: 'transactionType', column: 'TransactionType', type: 'enum', label: 'Transaction Type', labelKey: 'matchRuleColType', enumLabels: { 'B': 'Bank fee', 'O': 'Other', 'R': 'Recurring', 'H': 'Tax retention', 'T': 'Transfer' }, cellType: 'typePill', tones: {"H":"blue","T":"neutral","B":"amber","R":"green","O":"neutral"} },
  { key: 'accountingAccount', column: 'C_ElementValue_ID', type: 'selector', label: 'Accounting Account', labelKey: 'matchRuleColAccount' },
  { key: 'amountTolerancePct', column: 'AmountTolerancePct', type: 'number', label: 'Amount Tolerance Pct', labelKey: 'matchRuleColTolerance', cellType: 'percent' },
  { key: 'matchCount', column: 'MatchCount', type: 'number', label: 'Match Count', labelKey: 'matchRuleColReconciliations', cellType: 'boldText' },
  { key: 'active', column: 'Isactive', type: 'boolean', label: 'Active', labelKey: 'matchRuleColActive', toggle: true, cellType: 'toggle' },
];
// @sf-generated-end columns:etgoMatchRuleHeader

// @sf-generated-start fields:etgoMatchRuleHeader
const fields = [
  { key: 'name', column: 'Name', type: 'text', label: 'Name', required: true, section: 'general', placeholderKey: 'matchRuleNamePlaceholder' },
  { key: 'textPattern', column: 'TextPattern', type: 'text', label: 'Text Pattern', required: true, section: 'general', placeholderKey: 'matchRulePatternPlaceholder' },
  { key: 'financialAccount', column: 'FIN_Financial_Account_ID', type: 'selector', label: 'Financial Account', reference: 'Financial_Account', inputMode: 'selector', section: 'general', emptyOptionLabelKey: 'matchRuleAllAccounts' },
  { key: 'transactionType', column: 'TransactionType', type: 'select', label: 'Transaction Type', section: 'general', options: [{ value: 'B', label: 'Bank fee' }, { value: 'O', label: 'Other' }, { value: 'R', label: 'Recurring' }, { value: 'H', label: 'Tax retention' }, { value: 'T', label: 'Transfer' }] },
  { key: 'accountingAccount', column: 'C_ElementValue_ID', type: 'selector', label: 'Accounting Account', reference: 'ElementValue', inputMode: 'selector', section: 'general' },
  { key: 'textCondition', column: 'TextCondition', type: 'select', label: 'Text Condition', required: true, section: 'general', options: [{ value: 'C', label: 'Contains' }, { value: 'R', label: 'Regex' }, { value: 'S', label: 'Starts with' }] },
  { key: 'amountTolerancePct', column: 'AmountTolerancePct', type: 'number', label: 'Amount Tolerance Pct', section: 'general', defaultValue: '0' },
  { key: 'priority', column: 'Priority', type: 'number', label: 'Priority', required: true, section: 'general' },
  { key: 'businessPartner', column: 'C_BPartner_ID', type: 'selector', label: 'Business Partner', reference: 'BPartner', inputMode: 'selector', section: 'general' },
  { key: 'createTransaction', column: 'CreateTransaction', type: 'checkbox', label: 'Create Transaction', section: 'general', help: 'matchRuleCreateTransactionHelper' },
  { key: 'project', column: 'C_Project_ID', type: 'selector', label: 'Project', reference: 'Project', inputMode: 'selector', section: 'dimensions' },
  { key: 'costCenter', column: 'C_Costcenter_ID', type: 'selector', label: 'Cost Center', reference: 'Costcenter', inputMode: 'selector', section: 'dimensions' },
  { key: 'user1Dimension', column: 'User1_ID', type: 'selector', label: 'User1 Dimension', reference: 'User1', inputMode: 'selector', section: 'dimensions' },
  { key: 'user2Dimension', column: 'User2_ID', type: 'selector', label: 'User2 Dimension', reference: 'User2', inputMode: 'selector', section: 'dimensions' },
  { key: 'salesRegion', column: 'C_Salesregion_ID', type: 'selector', label: 'Sales Region', reference: 'Salesregion', inputMode: 'selector', section: 'dimensions' },
  { key: 'activity', column: 'C_Activity_ID', type: 'selector', label: 'Activity', reference: 'Activity', inputMode: 'selector', section: 'dimensions' },
  { key: 'campaign', column: 'C_Campaign_ID', type: 'selector', label: 'Campaign', reference: 'Campaign', inputMode: 'selector', section: 'dimensions' },
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
  "footerToggleField": "createTransaction",
  "sectionGrid": {
    "general": 3,
    "dimensions": 4
  },
  "backLabelKey": "cancel",
  "backTo": null,
  "toolbarFilters": [
    {
      "key": "transactionType",
      "field": "transactionType",
      "allLabelKey": "matchRuleFilterAllRules",
      "options": [
        {
          "value": "H",
          "labelKey": "matchRuleTxnTypeRetention"
        },
        {
          "value": "T",
          "labelKey": "matchRuleTxnTypeTransfer"
        },
        {
          "value": "B",
          "labelKey": "matchRuleTxnTypeBankFee"
        },
        {
          "value": "R",
          "labelKey": "matchRuleTxnTypeRecurring"
        },
        {
          "value": "O",
          "labelKey": "matchRuleTxnTypeOther"
        }
      ]
    },
    {
      "key": "active",
      "field": "active",
      "allLabelKey": "matchRuleFilterAllStates",
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
      "field": "accountingAccount",
      "column": "C_ElementValue_ID",
      "reference": "ElementValue",
      "inputMode": "selector",
      "url": "/sws/neo/match-rule/etgoMatchRuleHeader/selectors/accountingAccount"
    },
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
      "field": "activity",
      "column": "C_Activity_ID",
      "reference": "Activity",
      "inputMode": "selector",
      "url": "/sws/neo/match-rule/etgoMatchRuleHeader/selectors/activity"
    },
    {
      "entity": "etgoMatchRuleHeader",
      "field": "campaign",
      "column": "C_Campaign_ID",
      "reference": "Campaign",
      "inputMode": "selector",
      "url": "/sws/neo/match-rule/etgoMatchRuleHeader/selectors/campaign"
    },
    {
      "entity": "etgoMatchRuleHeader",
      "field": "salesRegion",
      "column": "C_Salesregion_ID",
      "reference": "Salesregion",
      "inputMode": "selector",
      "url": "/sws/neo/match-rule/etgoMatchRuleHeader/selectors/salesRegion"
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
      "C_ElementValue_ID": "Cuenta contable",
      "AmountTolerancePct": "Tolerancia de importe (%)",
      "CreateTransaction": "Crear transacción automáticamente",
      "MatchCount": "Conciliaciones",
      "Isactive": "Activa",
      "C_BPartner_ID": "Tercero por defecto",
      "FIN_Financial_Account_ID": "Afecta a",
      "C_Project_ID": "Proyecto",
      "C_Costcenter_ID": "Centro de coste",
      "C_Activity_ID": "Actividad",
      "C_Campaign_ID": "Campaña",
      "C_Salesregion_ID": "Región de ventas",
      "User1_ID": "1ª Dimensión",
      "User2_ID": "2ª Dimensión"
    },
    "en_US": {
      "Name": "Name",
      "Priority": "Priority",
      "TextCondition": "Concept condition",
      "TextPattern": "Pattern to match",
      "TransactionType": "Transaction type",
      "C_ElementValue_ID": "Accounting account",
      "AmountTolerancePct": "Amount tolerance (%)",
      "CreateTransaction": "Create transaction automatically",
      "MatchCount": "Reconciliations",
      "Isactive": "Active",
      "C_BPartner_ID": "Default business partner",
      "FIN_Financial_Account_ID": "Applies to",
      "C_Project_ID": "Project",
      "C_Costcenter_ID": "Cost center",
      "C_Activity_ID": "Activity",
      "C_Campaign_ID": "Campaign",
      "C_Salesregion_ID": "Sales region",
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

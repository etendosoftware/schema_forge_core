import BusinessPartnerPage from './BusinessPartnerPage';

const windowMeta = { category: 'people', name: 'Business Partner' };

const api = {
  "specName": "business-partner",
  "baseUrl": "/sws/neo/business-partner",
  "crud": {
    "bpartner": {
      "get": true,
      "getById": true,
      "post": true,
      "put": true,
      "patch": true,
      "delete": true,
      "listUrl": "/sws/neo/business-partner/bpartner",
      "detailUrl": "/sws/neo/business-partner/bpartner/{id}",
      "supportedFilters": [
        "name",
        "searchKey"
      ]
    },
    "bpCustomerAcct": {
      "get": true,
      "getById": true,
      "post": true,
      "put": true,
      "patch": true,
      "delete": true,
      "listUrl": "/sws/neo/business-partner/bpCustomerAcct",
      "detailUrl": "/sws/neo/business-partner/bpCustomerAcct/{id}",
      "supportedFilters": []
    },
    "bpVendorAcct": {
      "get": true,
      "getById": true,
      "post": true,
      "put": true,
      "patch": true,
      "delete": true,
      "listUrl": "/sws/neo/business-partner/bpVendorAcct",
      "detailUrl": "/sws/neo/business-partner/bpVendorAcct/{id}",
      "supportedFilters": []
    },
    "bpEmployeeAcct": {
      "get": true,
      "getById": true,
      "post": true,
      "put": true,
      "patch": true,
      "delete": true,
      "listUrl": "/sws/neo/business-partner/bpEmployeeAcct",
      "detailUrl": "/sws/neo/business-partner/bpEmployeeAcct/{id}",
      "supportedFilters": []
    },
    "bpSalcategory": {
      "get": true,
      "getById": true,
      "post": true,
      "put": true,
      "patch": true,
      "delete": true,
      "listUrl": "/sws/neo/business-partner/bpSalcategory",
      "detailUrl": "/sws/neo/business-partner/bpSalcategory/{id}",
      "supportedFilters": []
    },
    "bpBankAccount": {
      "get": true,
      "getById": true,
      "post": true,
      "put": true,
      "patch": true,
      "delete": true,
      "listUrl": "/sws/neo/business-partner/bpBankAccount",
      "detailUrl": "/sws/neo/business-partner/bpBankAccount/{id}",
      "supportedFilters": []
    },
    "bpartnerDocType": {
      "get": true,
      "getById": true,
      "post": true,
      "put": true,
      "patch": true,
      "delete": true,
      "listUrl": "/sws/neo/business-partner/bpartnerDocType",
      "detailUrl": "/sws/neo/business-partner/bpartnerDocType/{id}",
      "supportedFilters": []
    },
    "bpartnerLocation": {
      "get": true,
      "getById": true,
      "post": true,
      "put": true,
      "patch": true,
      "delete": true,
      "listUrl": "/sws/neo/business-partner/bpartnerLocation",
      "detailUrl": "/sws/neo/business-partner/bpartnerLocation/{id}",
      "supportedFilters": [
        "name"
      ]
    },
    "user": {
      "get": true,
      "getById": true,
      "post": true,
      "put": true,
      "patch": true,
      "delete": true,
      "listUrl": "/sws/neo/business-partner/user",
      "detailUrl": "/sws/neo/business-partner/user/{id}",
      "supportedFilters": []
    },
    "bpartnerDiscount": {
      "get": true,
      "getById": true,
      "post": true,
      "put": true,
      "patch": true,
      "delete": true,
      "listUrl": "/sws/neo/business-partner/bpartnerDiscount",
      "detailUrl": "/sws/neo/business-partner/bpartnerDiscount/{id}",
      "supportedFilters": []
    }
  },
  "selectors": [
    {
      "entity": "bpartner",
      "field": "salaryCategory",
      "column": "C_Salary_Category_ID",
      "reference": "Salary_Category",
      "inputMode": "selector",
      "url": "/sws/neo/business-partner/bpartner/selectors/salaryCategory"
    },
    {
      "entity": "bpartner",
      "field": "businessPartnerCategory",
      "column": "C_BP_Group_ID",
      "reference": "BusinessPartnerCategory",
      "inputMode": "selector",
      "url": "/sws/neo/business-partner/bpartner/selectors/businessPartnerCategory"
    },
    {
      "entity": "bpartner",
      "field": "paymentTerms",
      "column": "C_PaymentTerm_ID",
      "reference": "PaymentTerm",
      "inputMode": "selector",
      "url": "/sws/neo/business-partner/bpartner/selectors/paymentTerms"
    },
    {
      "entity": "bpartner",
      "field": "account",
      "column": "FIN_Financial_Account_ID",
      "reference": "FIN_Financial_Account",
      "inputMode": "selector",
      "url": "/sws/neo/business-partner/bpartner/selectors/account"
    },
    {
      "entity": "bpartner",
      "field": "paymentMethod",
      "column": "FIN_Paymentmethod_ID",
      "reference": "PaymentMethod",
      "inputMode": "selector",
      "url": "/sws/neo/business-partner/bpartner/selectors/paymentMethod"
    },
    {
      "entity": "bpartner",
      "field": "priceList",
      "column": "M_PriceList_ID",
      "reference": "PriceList",
      "inputMode": "selector",
      "url": "/sws/neo/business-partner/bpartner/selectors/priceList"
    },
    {
      "entity": "bpartner",
      "field": "pOFinancialAccount",
      "column": "PO_Financial_Account_ID",
      "reference": "FIN_Financial_Account",
      "inputMode": "selector",
      "url": "/sws/neo/business-partner/bpartner/selectors/pOFinancialAccount"
    },
    {
      "entity": "bpartner",
      "field": "pOPaymentMethod",
      "column": "PO_Paymentmethod_ID",
      "reference": "PaymentMethod",
      "inputMode": "selector",
      "url": "/sws/neo/business-partner/bpartner/selectors/pOPaymentMethod"
    },
    {
      "entity": "bpartner",
      "field": "pOPaymentTerms",
      "column": "PO_PaymentTerm_ID",
      "reference": "PaymentTerm",
      "inputMode": "selector",
      "url": "/sws/neo/business-partner/bpartner/selectors/pOPaymentTerms"
    },
    {
      "entity": "bpartner",
      "field": "purchasePricelist",
      "column": "PO_PriceList_ID",
      "reference": "PriceList",
      "inputMode": "selector",
      "url": "/sws/neo/business-partner/bpartner/selectors/purchasePricelist"
    },
    {
      "entity": "bpartner",
      "field": "salaryCategory",
      "column": "C_Salary_Category_ID",
      "reference": "Salary_Category",
      "inputMode": "selector",
      "url": "/sws/neo/business-partner/bpartner/selectors/salaryCategory"
    },
    {
      "entity": "bpartner",
      "field": "businessPartnerCategory",
      "column": "C_BP_Group_ID",
      "reference": "BusinessPartnerCategory",
      "inputMode": "selector",
      "url": "/sws/neo/business-partner/bpartner/selectors/businessPartnerCategory"
    },
    {
      "entity": "bpartner",
      "field": "paymentTerms",
      "column": "C_PaymentTerm_ID",
      "reference": "PaymentTerm",
      "inputMode": "selector",
      "url": "/sws/neo/business-partner/bpartner/selectors/paymentTerms"
    },
    {
      "entity": "bpartner",
      "field": "account",
      "column": "FIN_Financial_Account_ID",
      "reference": "FIN_Financial_Account",
      "inputMode": "selector",
      "url": "/sws/neo/business-partner/bpartner/selectors/account"
    },
    {
      "entity": "bpartner",
      "field": "paymentMethod",
      "column": "FIN_Paymentmethod_ID",
      "reference": "PaymentMethod",
      "inputMode": "selector",
      "url": "/sws/neo/business-partner/bpartner/selectors/paymentMethod"
    },
    {
      "entity": "bpartner",
      "field": "priceList",
      "column": "M_PriceList_ID",
      "reference": "PriceList",
      "inputMode": "selector",
      "url": "/sws/neo/business-partner/bpartner/selectors/priceList"
    },
    {
      "entity": "bpartner",
      "field": "pOFinancialAccount",
      "column": "PO_Financial_Account_ID",
      "reference": "FIN_Financial_Account",
      "inputMode": "selector",
      "url": "/sws/neo/business-partner/bpartner/selectors/pOFinancialAccount"
    },
    {
      "entity": "bpartner",
      "field": "pOPaymentMethod",
      "column": "PO_Paymentmethod_ID",
      "reference": "PaymentMethod",
      "inputMode": "selector",
      "url": "/sws/neo/business-partner/bpartner/selectors/pOPaymentMethod"
    },
    {
      "entity": "bpartner",
      "field": "pOPaymentTerms",
      "column": "PO_PaymentTerm_ID",
      "reference": "PaymentTerm",
      "inputMode": "selector",
      "url": "/sws/neo/business-partner/bpartner/selectors/pOPaymentTerms"
    },
    {
      "entity": "bpartner",
      "field": "purchasePricelist",
      "column": "PO_PriceList_ID",
      "reference": "PriceList",
      "inputMode": "selector",
      "url": "/sws/neo/business-partner/bpartner/selectors/purchasePricelist"
    },
    {
      "entity": "bpCustomerAcct",
      "field": "accountingSchema",
      "column": "C_AcctSchema_ID",
      "reference": "AcctSchema",
      "inputMode": "selector",
      "url": "/sws/neo/business-partner/bpCustomerAcct/selectors/accountingSchema"
    },
    {
      "entity": "bpCustomerAcct",
      "field": "customerReceivablesNo",
      "column": "C_Receivable_Acct",
      "reference": "ValidCombination",
      "inputMode": "selector",
      "url": "/sws/neo/business-partner/bpCustomerAcct/selectors/customerReceivablesNo"
    },
    {
      "entity": "bpCustomerAcct",
      "field": "customerPrepayment",
      "column": "C_Prepayment_Acct",
      "reference": "ValidCombination",
      "inputMode": "selector",
      "url": "/sws/neo/business-partner/bpCustomerAcct/selectors/customerPrepayment"
    },
    {
      "entity": "bpartner",
      "field": "salaryCategory",
      "column": "C_Salary_Category_ID",
      "reference": "Salary_Category",
      "inputMode": "selector",
      "url": "/sws/neo/business-partner/bpartner/selectors/salaryCategory"
    },
    {
      "entity": "bpartner",
      "field": "businessPartnerCategory",
      "column": "C_BP_Group_ID",
      "reference": "BusinessPartnerCategory",
      "inputMode": "selector",
      "url": "/sws/neo/business-partner/bpartner/selectors/businessPartnerCategory"
    },
    {
      "entity": "bpartner",
      "field": "paymentTerms",
      "column": "C_PaymentTerm_ID",
      "reference": "PaymentTerm",
      "inputMode": "selector",
      "url": "/sws/neo/business-partner/bpartner/selectors/paymentTerms"
    },
    {
      "entity": "bpartner",
      "field": "account",
      "column": "FIN_Financial_Account_ID",
      "reference": "FIN_Financial_Account",
      "inputMode": "selector",
      "url": "/sws/neo/business-partner/bpartner/selectors/account"
    },
    {
      "entity": "bpartner",
      "field": "paymentMethod",
      "column": "FIN_Paymentmethod_ID",
      "reference": "PaymentMethod",
      "inputMode": "selector",
      "url": "/sws/neo/business-partner/bpartner/selectors/paymentMethod"
    },
    {
      "entity": "bpartner",
      "field": "priceList",
      "column": "M_PriceList_ID",
      "reference": "PriceList",
      "inputMode": "selector",
      "url": "/sws/neo/business-partner/bpartner/selectors/priceList"
    },
    {
      "entity": "bpartner",
      "field": "pOFinancialAccount",
      "column": "PO_Financial_Account_ID",
      "reference": "FIN_Financial_Account",
      "inputMode": "selector",
      "url": "/sws/neo/business-partner/bpartner/selectors/pOFinancialAccount"
    },
    {
      "entity": "bpartner",
      "field": "pOPaymentMethod",
      "column": "PO_Paymentmethod_ID",
      "reference": "PaymentMethod",
      "inputMode": "selector",
      "url": "/sws/neo/business-partner/bpartner/selectors/pOPaymentMethod"
    },
    {
      "entity": "bpartner",
      "field": "pOPaymentTerms",
      "column": "PO_PaymentTerm_ID",
      "reference": "PaymentTerm",
      "inputMode": "selector",
      "url": "/sws/neo/business-partner/bpartner/selectors/pOPaymentTerms"
    },
    {
      "entity": "bpartner",
      "field": "purchasePricelist",
      "column": "PO_PriceList_ID",
      "reference": "PriceList",
      "inputMode": "selector",
      "url": "/sws/neo/business-partner/bpartner/selectors/purchasePricelist"
    },
    {
      "entity": "bpVendorAcct",
      "field": "accountingSchema",
      "column": "C_AcctSchema_ID",
      "reference": "AcctSchema",
      "inputMode": "selector",
      "url": "/sws/neo/business-partner/bpVendorAcct/selectors/accountingSchema"
    },
    {
      "entity": "bpVendorAcct",
      "field": "vendorLiability",
      "column": "V_Liability_Acct",
      "reference": "ValidCombination",
      "inputMode": "selector",
      "url": "/sws/neo/business-partner/bpVendorAcct/selectors/vendorLiability"
    },
    {
      "entity": "bpVendorAcct",
      "field": "vendorPrepayment",
      "column": "V_Prepayment_Acct",
      "reference": "ValidCombination",
      "inputMode": "selector",
      "url": "/sws/neo/business-partner/bpVendorAcct/selectors/vendorPrepayment"
    },
    {
      "entity": "bpartner",
      "field": "salaryCategory",
      "column": "C_Salary_Category_ID",
      "reference": "Salary_Category",
      "inputMode": "selector",
      "url": "/sws/neo/business-partner/bpartner/selectors/salaryCategory"
    },
    {
      "entity": "bpartner",
      "field": "businessPartnerCategory",
      "column": "C_BP_Group_ID",
      "reference": "BusinessPartnerCategory",
      "inputMode": "selector",
      "url": "/sws/neo/business-partner/bpartner/selectors/businessPartnerCategory"
    },
    {
      "entity": "bpartner",
      "field": "paymentTerms",
      "column": "C_PaymentTerm_ID",
      "reference": "PaymentTerm",
      "inputMode": "selector",
      "url": "/sws/neo/business-partner/bpartner/selectors/paymentTerms"
    },
    {
      "entity": "bpartner",
      "field": "account",
      "column": "FIN_Financial_Account_ID",
      "reference": "FIN_Financial_Account",
      "inputMode": "selector",
      "url": "/sws/neo/business-partner/bpartner/selectors/account"
    },
    {
      "entity": "bpartner",
      "field": "paymentMethod",
      "column": "FIN_Paymentmethod_ID",
      "reference": "PaymentMethod",
      "inputMode": "selector",
      "url": "/sws/neo/business-partner/bpartner/selectors/paymentMethod"
    },
    {
      "entity": "bpartner",
      "field": "priceList",
      "column": "M_PriceList_ID",
      "reference": "PriceList",
      "inputMode": "selector",
      "url": "/sws/neo/business-partner/bpartner/selectors/priceList"
    },
    {
      "entity": "bpartner",
      "field": "pOFinancialAccount",
      "column": "PO_Financial_Account_ID",
      "reference": "FIN_Financial_Account",
      "inputMode": "selector",
      "url": "/sws/neo/business-partner/bpartner/selectors/pOFinancialAccount"
    },
    {
      "entity": "bpartner",
      "field": "pOPaymentMethod",
      "column": "PO_Paymentmethod_ID",
      "reference": "PaymentMethod",
      "inputMode": "selector",
      "url": "/sws/neo/business-partner/bpartner/selectors/pOPaymentMethod"
    },
    {
      "entity": "bpartner",
      "field": "pOPaymentTerms",
      "column": "PO_PaymentTerm_ID",
      "reference": "PaymentTerm",
      "inputMode": "selector",
      "url": "/sws/neo/business-partner/bpartner/selectors/pOPaymentTerms"
    },
    {
      "entity": "bpartner",
      "field": "purchasePricelist",
      "column": "PO_PriceList_ID",
      "reference": "PriceList",
      "inputMode": "selector",
      "url": "/sws/neo/business-partner/bpartner/selectors/purchasePricelist"
    },
    {
      "entity": "bpEmployeeAcct",
      "field": "accountingSchema",
      "column": "C_AcctSchema_ID",
      "reference": "AcctSchema",
      "inputMode": "selector",
      "url": "/sws/neo/business-partner/bpEmployeeAcct/selectors/accountingSchema"
    },
    {
      "entity": "bpSalcategory",
      "field": "salaryCategory",
      "column": "C_Salary_Category_ID",
      "reference": "Salary_Category",
      "inputMode": "selector",
      "url": "/sws/neo/business-partner/bpSalcategory/selectors/salaryCategory"
    },
    {
      "entity": "bpBankAccount",
      "field": "country",
      "column": "C_Country_ID",
      "reference": "Country",
      "inputMode": "selector",
      "url": "/sws/neo/business-partner/bpBankAccount/selectors/country"
    },
    {
      "entity": "bpBankAccount",
      "field": "userContact",
      "column": "AD_User_ID",
      "reference": "User",
      "inputMode": "selector",
      "url": "/sws/neo/business-partner/bpBankAccount/selectors/userContact"
    },
    {
      "entity": "bpartnerDocType",
      "field": "cDoctypeID",
      "column": "C_Doctype_ID",
      "reference": "DocType",
      "inputMode": "selector",
      "url": "/sws/neo/business-partner/bpartnerDocType/selectors/cDoctypeID"
    },
    {
      "entity": "bpartnerLocation",
      "field": "locationAddress",
      "column": "C_Location_ID",
      "reference": "Location",
      "inputMode": "search",
      "url": "/sws/neo/business-partner/bpartnerLocation/selectors/locationAddress"
    },
    {
      "entity": "bpartnerDiscount",
      "field": "discount",
      "column": "C_Discount_ID",
      "reference": "Discount",
      "inputMode": "selector",
      "url": "/sws/neo/business-partner/bpartnerDiscount/selectors/discount"
    }
  ],
  "actions": [
    {
      "entity": "bpartner",
      "field": "setNewCurrency",
      "column": "Update_Currency",
      "url": "/sws/neo/business-partner/bpartner/{id}/action/setNewCurrency"
    },
    {
      "entity": "bpartner",
      "field": "setNewCurrency",
      "column": "Update_Currency",
      "url": "/sws/neo/business-partner/bpartner/{id}/action/setNewCurrency"
    },
    {
      "entity": "bpartner",
      "field": "setNewCurrency",
      "column": "Update_Currency",
      "url": "/sws/neo/business-partner/bpartner/{id}/action/setNewCurrency"
    },
    {
      "entity": "bpartner",
      "field": "setNewCurrency",
      "column": "Update_Currency",
      "url": "/sws/neo/business-partner/bpartner/{id}/action/setNewCurrency"
    },
    {
      "entity": "user",
      "field": "grantPortalAccess",
      "column": "Grant_Portal_Access",
      "url": "/sws/neo/business-partner/user/{id}/action/grantPortalAccess"
    },
    {
      "entity": "user",
      "field": "processNow",
      "column": "Processing",
      "url": "/sws/neo/business-partner/user/{id}/action/processNow"
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
      "example": "_sortBy=business-partnerDate"
    },
    "filtering": "Use field name as query param: ?fieldName=value",
    "parentFilter": "parentId={id} for child entities"
  }
};

// @sf-generated-start component:App
export default function App({ windowName, recordId, token, apiBaseUrl, window, ...rest }) {
  // @sf-custom-slot hooks:App
  return <BusinessPartnerPage windowName={windowName} recordId={recordId} token={token} apiBaseUrl={apiBaseUrl} window={window || windowMeta} api={api} {...rest} />;
}
// @sf-generated-end component:App

// @sf-custom-slot section:App-custom

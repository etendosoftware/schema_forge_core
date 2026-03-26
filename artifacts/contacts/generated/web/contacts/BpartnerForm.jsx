import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:bpartner
const fields = [
  { key: 'employee', column: 'IsEmployee', type: 'checkbox', required: true, section: 'principal' },
  { key: 'isSalesRepresentative', column: 'IsSalesRep', type: 'checkbox', required: true, section: 'principal' },
  { key: 'name', column: 'Name', type: 'text', required: true, section: 'principal' },
  { key: 'operator', column: 'Isworker', type: 'checkbox', section: 'principal' },
  { key: 'salaryCategory', column: 'C_Salary_Category_ID', type: 'selector', readOnly: true, section: 'other', reference: 'Salary_Category', inputMode: 'selector' },
  { key: 'searchKey', column: 'Value', type: 'text', required: true, section: 'principal' },
  { key: 'active', column: 'IsActive', type: 'checkbox', required: true, readOnly: true, section: 'other' },
  { key: 'businessPartnerCategory', column: 'C_BP_Group_ID', type: 'selector', required: true, section: 'principal', reference: 'BusinessPartnerCategory', inputMode: 'selector' },
  { key: 'paymentTerms', column: 'C_PaymentTerm_ID', type: 'selector', section: 'principal', reference: 'PaymentTerm', inputMode: 'selector', displayLogic: (record) => record.customer },
  { key: 'customerBlocking', column: 'Customer_Blocking', type: 'checkbox', required: true, section: 'principal', displayLogic: (record) => record.customer },
  { key: 'description', column: 'Description', type: 'textarea', section: 'principal' },
  { key: 'account', column: 'FIN_Financial_Account_ID', type: 'selector', section: 'principal', reference: 'FIN_Financial_Account', inputMode: 'selector', displayLogic: (record) => record.customer },
  // @sf-custom-slot callout:SE_PaymentMethod_FinAccount
  { key: 'paymentMethod', column: 'FIN_Paymentmethod_ID', type: 'selector', section: 'principal', reference: 'PaymentMethod', inputMode: 'selector', displayLogic: (record) => record.customer },
  { key: 'customer', column: 'IsCustomer', type: 'checkbox', required: true, section: 'principal' },
  { key: 'vendor', column: 'IsVendor', type: 'checkbox', required: true, section: 'principal' },
  { key: 'priceList', column: 'M_PriceList_ID', type: 'selector', section: 'principal', reference: 'PriceList', inputMode: 'selector', displayLogic: (record) => record.customer },
  { key: 'pOFinancialAccount', column: 'PO_Financial_Account_ID', type: 'selector', section: 'principal', reference: 'FIN_Financial_Account', inputMode: 'selector', displayLogic: (record) => record.vendor },
  // @sf-custom-slot callout:SE_PaymentMethod_FinAccount
  { key: 'pOPaymentMethod', column: 'PO_Paymentmethod_ID', type: 'selector', section: 'principal', reference: 'PaymentMethod', inputMode: 'selector', displayLogic: (record) => record.vendor },
  { key: 'pOPaymentTerms', column: 'PO_PaymentTerm_ID', type: 'selector', section: 'principal', reference: 'PaymentTerm', inputMode: 'selector', displayLogic: (record) => record.vendor },
  { key: 'purchasePricelist', column: 'PO_PriceList_ID', type: 'selector', section: 'principal', reference: 'PriceList', inputMode: 'selector', displayLogic: (record) => record.vendor },
  { key: 'creditLimit', column: 'SO_CreditLimit', type: 'number', required: true, section: 'other' },
  { key: 'creditUsed', column: 'SO_CreditUsed', type: 'number', required: true, readOnly: true, section: 'other' },
  { key: 'taxID', column: 'TaxID', type: 'text', section: 'other' },
  { key: 'vendorBlocking', column: 'Vendor_Blocking', type: 'checkbox', required: true, section: 'principal', displayLogic: (record) => record.vendor },
];
// @sf-generated-end fields:bpartner

// @sf-generated-start component:BpartnerForm
export default function BpartnerForm(props) {
  // @sf-custom-slot hooks:BpartnerForm
  return <EntityForm fields={fields} {...props} />;
}
// @sf-generated-end component:BpartnerForm

// @sf-custom-slot section:BpartnerForm-custom

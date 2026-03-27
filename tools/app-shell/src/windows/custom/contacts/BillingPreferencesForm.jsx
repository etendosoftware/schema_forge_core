import { EntityForm } from '@/components/contract-ui';

// Separamos los arrays de campos para mayor limpieza
const customerFields = [
  { key: 'priceList', column: 'M_PriceList_ID', type: 'selector', section: 'principal', inputMode: 'selector' },
  { key: 'paymentMethod', column: 'FIN_Paymentmethod_ID', type: 'selector', section: 'principal', inputMode: 'selector' },
  { key: 'paymentTerms', column: 'C_PaymentTerm_ID', type: 'selector', section: 'principal', inputMode: 'selector' },
  { key: 'account', column: 'FIN_Financial_Account_ID', type: 'selector', section: 'principal', inputMode: 'selector' },
  { key: 'customerBlocking', column: 'Customer_Blocking', type: 'checkbox', section: 'principal' },
];

const vendorFields = [
  { key: 'purchasePricelist', column: 'PO_PriceList_ID', type: 'selector', section: 'principal', inputMode: 'selector' },
  { key: 'pOPaymentMethod', column: 'PO_Paymentmethod_ID', type: 'selector', section: 'principal', inputMode: 'selector' },
  { key: 'pOPaymentTerms', column: 'PO_PaymentTerm_ID', type: 'selector', section: 'principal', inputMode: 'selector' },
  { key: 'pOFinancialAccount', column: 'PO_Financial_Account_ID', type: 'selector', section: 'principal', inputMode: 'selector' },
  { key: 'vendorBlocking', column: 'Vendor_Blocking', type: 'checkbox', section: 'principal' },
];

export default function BillingPreferencesForm(props) {
  const { data } = props; // Extraemos la data del contacto (la cabecera)

  return (
    <div className="flex flex-col gap-8 pt-2">
      {/* SECCIÓN CLIENTE: Solo se renderiza si IsCustomer es true */}
      {data?.customer && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-foreground border-b border-border pb-2">
            Customer Billing (Sales)
          </h3>
          <EntityForm fields={customerFields} {...props} />
        </div>
      )}

      {/* SECCIÓN PROVEEDOR: Solo se renderiza si IsVendor es true */}
      {data?.vendor && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-foreground border-b border-border pb-2">
            Vendor Billing (Purchases)
          </h3>
          <EntityForm fields={vendorFields} {...props} />
        </div>
      )}
    </div>
  );
}

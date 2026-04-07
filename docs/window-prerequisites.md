# Window Prerequisites — NEO Headless Record Creation

When NEO Headless creates a record (POST), it resolves mandatory field values through a chain: AD_Column defaults → session context → callout cascade (header tabs only) → fallback FK resolution. If the required configuration is missing, creation fails with NOT NULL constraint violations.

This document lists the **minimum Etendo configuration** required for each transactional window.

---

## How NEO Resolves Mandatory Fields

| Step | Source | Example |
|------|--------|---------|
| 1 | AD_Column `defaultvalue` | `IsActive = 'Y'` |
| 2 | Session context / preferences | `@#AD_Org_ID@`, `@#Date@` |
| 3 | Callout cascade (header only) | BP callout → PaymentTerm, PriceList |
| 4 | `resolveDefaultDocTypeId` | Reads tab HQL to pick correct DocType |
| 5 | `resolveFallbackFkDefault` | First active record in referenced table |

**Document Type resolution** uses the AD_Tab's `hqlwhereclause` to determine the correct `DocSubTypeSO`. For example, Sales Quotation's tab filters by `sOSubType LIKE 'OB'`, so the resolved doctype must have `DocSubTypeSO = 'OB'`.

---

## Sales Quotation (`sales-quotation`)

**Table:** `C_Order` | **Tab HQL:** `e.salesTransaction=true AND e.transactionDocument.sOSubType LIKE 'OB'`

### Document Type
A `C_DocType` record must exist with:
- `DocBaseType = 'SOO'`
- `DocSubTypeSO = 'OB'`
- `IsSOTrx = 'Y'`
- `IsReturn = 'N'`
- Active, matching the client/org

### Mandatory FK Fields (no AD_Column default)
| Column | Resolved by | Fallback |
|--------|------------|----------|
| `C_DocType_ID` | `resolveDefaultDocTypeId` (default='0') | — |
| `C_DocTypeTarget_ID` | `resolveDefaultDocTypeId` | — |
| `C_BPartner_ID` | User selection | — |
| `C_BPartner_Location_ID` | User selection / BP callout | — |
| `BillTo_ID` | BP callout | — |
| `C_PaymentTerm_ID` | BP callout | First `C_PaymentTerm` for client |
| `M_PriceList_ID` | BP callout | First `M_PriceList` for client |
| `M_Warehouse_ID` | Org callout / context | First warehouse for org |

### Business Partner
The selected BP should have `C_PaymentTerm_ID` and `M_PriceList_ID` set (sales fields). If missing, the system falls back to the first available record in each table.

### Quick Check
```sql
-- Verify quotation doctype exists
SELECT c_doctype_id, name FROM c_doctype
WHERE docbasetype = 'SOO' AND docsubtypeso = 'OB' AND issotrx = 'Y'
  AND isactive = 'Y' AND ad_client_id = '<YOUR_CLIENT_ID>';

-- Verify at least one payment term and price list exist
SELECT 'PaymentTerm' as type, count(*) FROM c_paymentterm WHERE isactive='Y' AND ad_client_id = '<YOUR_CLIENT_ID>'
UNION ALL
SELECT 'PriceList', count(*) FROM m_pricelist WHERE isactive='Y' AND issopricelist='Y' AND ad_client_id = '<YOUR_CLIENT_ID>';
```

---

## Sales Order (`sales-order`)

**Table:** `C_Order` | **Tab HQL:** `e.salesTransaction=true AND e.transactionDocument.return=false AND e.transactionDocument.sOSubType NOT LIKE 'OB'`

### Document Type
A `C_DocType` record must exist with:
- `DocBaseType = 'SOO'`
- `DocSubTypeSO != 'OB'` (typically `'SO'` for Standard Order)
- `IsSOTrx = 'Y'`
- `IsReturn = 'N'`

### Mandatory FK Fields
Same as Sales Quotation (same table: `C_Order`).

### Quick Check
```sql
SELECT c_doctype_id, name, docsubtypeso FROM c_doctype
WHERE docbasetype = 'SOO' AND issotrx = 'Y' AND isreturn = 'N'
  AND (docsubtypeso IS NULL OR docsubtypeso != 'OB')
  AND isactive = 'Y' AND ad_client_id = '<YOUR_CLIENT_ID>';
```

---

## Sales Invoice (`sales-invoice`)

**Table:** `C_Invoice` | **Tab HQL:** `e.salesTransaction=true and e.documentStatus <> 'TEMP'`

### Document Type
A `C_DocType` record must exist with:
- `DocBaseType = 'ARI'` (AR Invoice)
- `IsSOTrx = 'Y'`

### Mandatory FK Fields (no AD_Column default)
| Column | Resolved by | Fallback |
|--------|------------|----------|
| `C_DocType_ID` | `resolveDefaultDocTypeId` (default='0') | — |
| `C_DocTypeTarget_ID` | `resolveDefaultDocTypeId` | — |
| `C_BPartner_ID` | User selection | — |
| `C_BPartner_Location_ID` | User selection / BP callout | — |
| `C_PaymentTerm_ID` | BP callout | First `C_PaymentTerm` for client |
| `M_PriceList_ID` | BP callout | First `M_PriceList` for client |
| `FIN_Paymentmethod_ID` | BP callout | First `FIN_PaymentMethod` for client |

### Quick Check
```sql
SELECT c_doctype_id, name FROM c_doctype
WHERE docbasetype = 'ARI' AND issotrx = 'Y'
  AND isactive = 'Y' AND ad_client_id = '<YOUR_CLIENT_ID>';
```

---

## Purchase Order (`purchase-order`)

**Table:** `C_Order` | **Tab HQL:** `e.salesTransaction=false AND e.transactionDocument.return=false`

### Document Type
A `C_DocType` record must exist with:
- `DocBaseType = 'POO'`
- `IsSOTrx = 'N'`
- `IsReturn = 'N'`

### Mandatory FK Fields
Same as Sales Order/Quotation but resolved with `IsSOTrx = 'N'`.

### Business Partner
The selected BP should have `PO_PaymentTerm_ID` and `PO_PriceList_ID` set (purchase fields).

### Quick Check
```sql
SELECT c_doctype_id, name FROM c_doctype
WHERE docbasetype = 'POO' AND issotrx = 'N' AND isreturn = 'N'
  AND isactive = 'Y' AND ad_client_id = '<YOUR_CLIENT_ID>';
```

---

## Purchase Invoice (`purchase-invoice`)

**Table:** `C_Invoice` | **Tab HQL:** `e.salesTransaction=false and e.documentStatus <> 'TEMP'`

### Document Type
A `C_DocType` record must exist with:
- `DocBaseType = 'API'` (AP Invoice)
- `IsSOTrx = 'N'`

### Mandatory FK Fields
Same as Sales Invoice but resolved with `IsSOTrx = 'N'`.

### Business Partner
Purchase payment terms and price list required on BP (`PO_PaymentTerm_ID`, `PO_PriceList_ID`).

### Quick Check
```sql
SELECT c_doctype_id, name FROM c_doctype
WHERE docbasetype = 'API' AND issotrx = 'N'
  AND isactive = 'Y' AND ad_client_id = '<YOUR_CLIENT_ID>';
```

---

## Goods Receipt (`goods-receipt`)

**Table:** `M_InOut` | **Tab HQL:** `e.movementType IN ('V-', 'V+') and e.logistic = 'N' and e.documentType.return=false`

### Document Type
A `C_DocType` record must exist with:
- `DocBaseType = 'MMR'` (Material Receipt)
- `IsReturn = 'N'`

### Mandatory FK Fields (no AD_Column default)
| Column | Resolved by | Fallback |
|--------|------------|----------|
| `C_DocType_ID` | `resolveDefaultDocTypeId` | — |
| `C_BPartner_ID` | User selection | — |
| `C_BPartner_Location_ID` | User selection / BP callout | — |
| `M_Warehouse_ID` | Context / org default | First warehouse for org |

### Quick Check
```sql
SELECT c_doctype_id, name FROM c_doctype
WHERE docbasetype = 'MMR' AND isreturn = 'N'
  AND isactive = 'Y' AND ad_client_id = '<YOUR_CLIENT_ID>';
```

---

## Goods Shipment (`goods-shipment`)

**Table:** `M_InOut` | **Tab HQL:** `e.movementType IN ('C-', 'C+') and e.logistic = 'N' and e.documentType.return=false`

### Document Type
A `C_DocType` record must exist with:
- `DocBaseType = 'MMS'` (Material Shipment)
- `IsReturn = 'N'`

### Mandatory FK Fields
Same as Goods Receipt.

### Quick Check
```sql
SELECT c_doctype_id, name FROM c_doctype
WHERE docbasetype = 'MMS' AND isreturn = 'N'
  AND isactive = 'Y' AND ad_client_id = '<YOUR_CLIENT_ID>';
```

---

## Payment In (`payment-in`)

**Table:** `FIN_Payment` | **Tab HQL:** `e.receipt='Y'`

### Document Type
A `C_DocType` record must exist with:
- `DocBaseType = 'ARR'` (AR Receipt / Payment In)

### Mandatory FK Fields (no AD_Column default)
| Column | Resolved by | Fallback |
|--------|------------|----------|
| `C_Currency_ID` | Financial account callout | First `C_Currency` for client |
| `Fin_Financial_Account_ID` | User selection | — |
| `Fin_Paymentmethod_ID` | Financial account callout | First `FIN_PaymentMethod` for client |

### Quick Check
```sql
SELECT c_doctype_id, name FROM c_doctype
WHERE docbasetype = 'ARR'
  AND isactive = 'Y' AND ad_client_id = '<YOUR_CLIENT_ID>';

-- Financial accounts must exist
SELECT count(*) as fin_accounts FROM fin_financial_account
WHERE isactive = 'Y' AND ad_client_id = '<YOUR_CLIENT_ID>';
```

---

## Payment Out (`payment-out`)

**Table:** `FIN_Payment` | **Tab HQL:** `e.receipt='N'`

### Document Type
A `C_DocType` record must exist with:
- `DocBaseType = 'APP'` (AP Payment / Payment Out)

### Mandatory FK Fields
Same as Payment In.

### Quick Check
```sql
SELECT c_doctype_id, name FROM c_doctype
WHERE docbasetype = 'APP'
  AND isactive = 'Y' AND ad_client_id = '<YOUR_CLIENT_ID>';
```

---

## Common Requirements (All Windows)

1. **Active Client and Organization** — The user's session must have a valid client and org.
2. **Warehouse** — At least one active warehouse assigned to the organization (for order/shipment/receipt windows).
3. **Currency** — At least one active `C_Currency` for the client (resolved from org or price list).
4. **Tax Configuration** — Products must have a `C_TaxCategory_ID`, and valid `C_Tax` records must exist for the fiscal zone. The product callout (`SL_Order_Product`) resolves the tax based on the product's tax category and the BP's fiscal position.
5. **Fiscal Calendar** — An open period must exist for the document's accounting date (`DateAcct`).

### Full Environment Quick Check
```sql
-- Run this to validate minimum configuration for all windows
SELECT 'DocTypes' as check_type,
  (SELECT count(DISTINCT docbasetype) FROM c_doctype WHERE isactive='Y' AND ad_client_id = '<YOUR_CLIENT_ID>') as count,
  'Need SOO,POO,ARI,API,MMS,MMR,ARR,APP' as expected
UNION ALL
SELECT 'PaymentTerms', count(*), 'At least 1' FROM c_paymentterm WHERE isactive='Y' AND ad_client_id = '<YOUR_CLIENT_ID>'
UNION ALL
SELECT 'SalesPriceLists', count(*), 'At least 1' FROM m_pricelist WHERE isactive='Y' AND issopricelist='Y' AND ad_client_id = '<YOUR_CLIENT_ID>'
UNION ALL
SELECT 'PurchPriceLists', count(*), 'At least 1' FROM m_pricelist WHERE isactive='Y' AND issopricelist='N' AND ad_client_id = '<YOUR_CLIENT_ID>'
UNION ALL
SELECT 'Warehouses', count(*), 'At least 1 per org' FROM m_warehouse WHERE isactive='Y' AND ad_client_id = '<YOUR_CLIENT_ID>'
UNION ALL
SELECT 'PaymentMethods', count(*), 'At least 1' FROM fin_paymentmethod WHERE isactive='Y' AND ad_client_id = '<YOUR_CLIENT_ID>'
UNION ALL
SELECT 'FinAccounts', count(*), 'At least 1' FROM fin_financial_account WHERE isactive='Y' AND ad_client_id = '<YOUR_CLIENT_ID>'
UNION ALL
SELECT 'Currencies', count(*), 'At least 1' FROM c_currency WHERE isactive='Y';
```

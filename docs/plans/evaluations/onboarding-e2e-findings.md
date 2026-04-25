# Onboarding E2E Findings

Date: 2026-04-24

## Basic E2E Coverage Available

Current basic onboarding E2E:

```bash
cd e2e
RUN_ONBOARDING_E2E=1 npx playwright test tests/flows/onboarding-invoice-readiness.spec.js --project=chromium
```

Test file:

- `e2e/tests/flows/onboarding-invoice-readiness.spec.js`

What it covers:

1. Opens `/onboarding`.
2. Creates a fresh user with a unique email.
3. Creates a fresh company/client with a unique company name.
4. Waits until the user reaches `/dashboard`.
5. Verifies the logged-in user button shows the new email.
6. Calls the real Sales Invoice payment term selector:
   - `/sws/neo/sales-invoice/header/selectors/C_PaymentTerm_ID?isSOTrx=Y&isCustomer=Y&limit=50&offset=0`
7. Verifies the selector returns at least one payment term.
8. Opens `/sales-invoice/new`.
9. Verifies the Sales Invoice new form renders.
10. Verifies the `Condiciones de pago*` combobox has a value.

This is the stable baseline E2E for onboarding. It intentionally stops before invoice-line creation because the manual DevTools exploration found additional product/tax selector issues below.

## Manual DevTools Flow Recorded

Manual flow attempted with Chrome DevTools against `http://localhost:3100`:

1. Opened `/onboarding`.
2. Created user:
   - Name: `QA Invoice Lines User`
   - Email pattern: `sbarrozo+invoice-lines-<timestamp>@gmail.com`
   - Password: `OnboardingQA2026!`
3. Continued the onboarding wizard.
4. Created company:
   - Company name pattern: `QA Invoice Lines <timestamp>`
   - Tax ID: `B12345678`
   - Address: `Calle QA 123, Madrid`
5. Reached `/dashboard` successfully.
6. Opened `/sales-invoice/new`.
7. Verified seeded selectors after onboarding:
   - Business partners: returns `Juan Perez`, `Laura Morat`, `Blanquiceleste S.A.`, `Proveedor Mayorista`.
   - Target document type: returns `AR Invoice`.
   - Payment term and price list are present in the form.
8. Selected contact `Juan Perez`.
9. Header was saved automatically when adding the first line.
10. Header URL became `/sales-invoice/<invoiceId>` and document number was assigned, e.g. `ARI/100000`.
11. Added line UI opened.
12. Selected product `Agua`.
13. Filled unit price `10`.
14. Attempted to select tax and save the line.

## Errors Found

### 1. Sales Invoice tax selector sends ISO date that backend validation cannot parse

Request observed from the UI:

```text
GET /sws/neo/sales-invoice/lines/selectors/C_Tax_ID?parentId=<invoiceId>&isSOTrx=Y&IsSOTrx=Y&priceList=<priceListId>&DateInvoiced=2026-04-25
```

Response:

```json
{
  "error": {
    "message": "@CODE=0@ERROR: date/time field value out of range: \"2026-04-25\"\n  Where: PL/pgSQL function to_date(text) line 3 at RETURN\nPL/pgSQL function lowerequaltimestamp(timestamp without time zone,character varying) line 3 at RETURN",
    "status": 500
  }
}
```

Manual comparison through `fetch` showed:

- `DateInvoiced=2026-04-25` returns 500.
- `DateInvoiced=25-04-2026` returns `IVA Normal`.

This blocks tax selection from the UI.

### 2. Saving invoice line without tax fails

Request body observed when clicking `Añadir línea` after product and price:

```json
{
  "product": "71F3A1E1CED444E3B654DF600DD2659F",
  "invoicedQuantity": 1,
  "unitPrice": 10,
  "product_PLIST": "5.00",
  "standardPrice": 5,
  "listPrice": 0,
  "priceLimit": 0,
  "cCurrencyId": "102",
  "deferred": "N",
  "taxableAmount": 5,
  "lineNetAmount": 10,
  "taxamt": 0,
  "grossUnitPrice": "0",
  "parentId": "<invoiceId>"
}
```

Response:

```json
{
  "error": {
    "message": " Imp.línea  es distinto de cero. Seleccione un  Impuesto ",
    "status": 500
  }
}
```

This is expected once the tax selector fails: the line cannot be saved with a non-zero amount and no tax.

### 3. Manual API line creation succeeds when tax is provided

Manual request with explicit tax:

```json
{
  "product": "71F3A1E1CED444E3B654DF600DD2659F",
  "invoicedQuantity": 1,
  "unitPrice": 10,
  "tax": "277ACBD6CC194F70989068F0659E26C6",
  "parentId": "<invoiceId>"
}
```

Response status: `200`.

Response included:

- `product$_identifier`: `Agua`
- `tax$_identifier`: `IVA Normal`
- `unitPrice`: `10`

After refreshing the invoice page, the line appeared in the UI:

- `Líneas 1`
- Product: `Agua`
- Quantity: `1`
- Unit price: `10`
- Tax: `IVA Normal`

This confirms the backend can persist invoice lines when tax is present; the UI blocker is the tax selector/date parameter path.

### 4. Earlier create-contact path failed with missing `C_BPartner.value`

Earlier manual inline contact creation from Sales Invoice failed with:

```text
ERROR: null value in column "value" of relation "c_bpartner" violates not-null constraint
```

A generic fix in `NeoCrudHandler` was intentionally not kept because it would have added contacts-specific behavior to generic CRUD infrastructure. This remains a separate issue to solve at the correct schema/field/default boundary if inline contact creation is required by the E2E.

## Recommended E2E Boundary

Keep the current basic onboarding E2E as the stable baseline:

- user creation
- company/client creation
- dashboard reachability
- Sales Invoice readiness selectors
- Sales Invoice new form readiness

Do not extend it to invoice-line UI creation until the tax selector date-format issue is fixed. Once fixed, extend the E2E with this observed UI sequence:

1. Open `/sales-invoice/new`.
2. Select seeded contact `Juan Perez`.
3. Click `+ Añadir líneas`.
4. Select product `Agua`.
5. Set unit price `10`.
6. Select tax `IVA Normal`.
7. Click `Añadir línea`.
8. Assert `Líneas 1` and `Agua` are visible.
9. Click `Guardar`.
10. Assert the invoice remains on `/sales-invoice/<id>` with status `Borrador` and line visible.

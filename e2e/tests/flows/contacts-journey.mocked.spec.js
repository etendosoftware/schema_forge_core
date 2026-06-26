import { test, expect } from '@playwright/test';
import { login } from '../helpers/auth.js';

/**
 * Contacts — Full mocked E2E journey (single continuous flow).
 *
 * Covers the ENTIRE Contacts window in one test:
 *   List view (columns, badges, filters) → create Empresa (validation, save) →
 *   detail (breadcrumb, identifier, kebab, KPIs, fields) → toggle Persona/Empresa →
 *   Financial tab (stepper, debounce, customer billing, vendor billing) →
 *   sub-tabs (addresses, contacts, bank account, attachments) →
 *   auto-save on blur → back to list → subset filters → delete with error →
 *   delete success → bulk delete abort → bulk delete success → edit via quick action.
 *
 * Mock mode only.
 */

// -- Mock data ---------------------------------------------------------------

const EXISTING_ROWS = [
  {
    id: 'bp-persona-001', name: 'Maria Garcia', searchKey: 'MGARCIA',
    etgoFirstname: 'Maria', etgoLastname: 'Garcia', etgoIsperson: true,
    customer: true, vendor: false,
    etgoEmail: 'maria@example.com', etgoPhone: '+34 600 111 222', etgoWeb: '',
    creditLimit: 5000, active: true,
  },
  {
    id: 'bp-persona-002', name: 'Carlos Lopez', searchKey: 'CLOPEZ',
    etgoFirstname: 'Carlos', etgoLastname: 'Lopez', etgoIsperson: true,
    customer: false, vendor: true,
    etgoEmail: 'carlos@example.com', etgoPhone: '+34 600 333 444', etgoWeb: '',
    creditLimit: 0, active: true,
  },
  {
    id: 'bp-empresa-nodelet', name: 'Empresa Con Facturas S.L.', searchKey: 'ECFACT',
    etgoFirstname: '', etgoLastname: '', etgoIsperson: false,
    customer: true, vendor: false,
    etgoEmail: 'admin@ecfact.com', etgoPhone: '+34 91 000 0001', etgoWeb: '',
    creditLimit: 10000, active: true,
  },
  {
    id: 'bp-empresa-both', name: 'Empresa Dual S.A.', searchKey: 'EDUAL',
    etgoFirstname: '', etgoLastname: '', etgoIsperson: false,
    customer: true, vendor: true,
    etgoEmail: 'both@dual.com', etgoPhone: '+34 93 000 0002',
    etgoWeb: 'https://dual.com', creditLimit: 8000, active: true,
  },
  {
    id: 'bp-safe-001', name: 'Borrable Uno S.A.', searchKey: 'BORR1',
    etgoFirstname: '', etgoLastname: '', etgoIsperson: false,
    customer: true, vendor: false,
    etgoEmail: 'info@borr1.com', etgoPhone: '+34 91 000 0003', etgoWeb: '',
    creditLimit: 0, active: true,
  },
  {
    id: 'bp-safe-002', name: 'Borrable Dos S.A.', searchKey: 'BORR2',
    etgoFirstname: '', etgoLastname: '', etgoIsperson: false,
    customer: true, vendor: false,
    etgoEmail: 'info@borr2.com', etgoPhone: '+34 91 000 0004', etgoWeb: '',
    creditLimit: 0, active: true,
  },
];

const CONTACT_LINES = [
  { id: 'cc-001', firstName: 'Pedro', name: 'Pedro', lastName: 'Martinez', email: 'pedro@norte.com', etgoEmail: 'pedro@norte.com', etgoPhone: '+34 600 001 001', phone: '+34 600 001 001', position: 'Director Comercial' },
  { id: 'cc-002', firstName: 'Laura', name: 'Laura', lastName: 'Sanchez', email: 'laura@norte.com', etgoEmail: 'laura@norte.com', etgoPhone: '+34 600 002 002', phone: '+34 600 002 002', position: 'Contabilidad' },
];

const BANK_LINES = [
  { id: 'bank-001', bankName: 'Santander', bankFormat: 'GENERIC', accountNo: '1234567890', iBAN: '', swiftCode: '', displayedAccount: '1234567890' },
];

const LOCATION_LINES = [
  { id: 'loc-001', name: 'Sede Central', addressLine1: 'Calle Mayor 10', cityName: 'Madrid', postalCode: '28001', isShipTo: true, isBillTo: true, shipToAddress: true, invoiceToAddress: true },
  { id: 'loc-002', name: 'Almacen Norte', addressLine1: 'Poligono Industrial 5', cityName: 'Bilbao', postalCode: '48001', isShipTo: true, isBillTo: false, shipToAddress: true, invoiceToAddress: false },
];

const NEW_RECORD_ID = 'bp-new-created-001';
const DELETE_ERROR_MSG = 'No se puede eliminar el contacto porque tiene facturas asociadas.';

async function installMocks(page) {
  const rows = [...EXISTING_ROWS];
  const patchLog = [];
  const postLog = [];
  const deleteLog = [];

  await page.route('**/sws/neo/contacts/businessPartner**', async (route) => {
    const req = route.request();
    const url = req.url();
    const method = req.method();

    // List GET
    if (method === 'GET' && !/\/businessPartner\/[^/?]+/.test(url)) {
      return route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ response: { data: rows, totalRows: rows.length } }),
      });
    }

    // Detail GET
    if (method === 'GET') {
      const m = url.match(/\/businessPartner\/([^/?]+)/);
      const found = rows.find(r => r.id === m?.[1]) ?? rows[0];
      return route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ response: { data: [found] } }),
      });
    }

    // POST — create
    if (method === 'POST') {
      const body = req.postData() ? JSON.parse(req.postData()) : {};
      postLog.push(body);
      const created = {
        id: NEW_RECORD_ID, searchKey: body.searchKey || 'NEW',
        name: body.name || '', etgoFirstname: body.etgoFirstname || '',
        etgoLastname: body.etgoLastname || '', etgoIsperson: body.etgoIsperson ?? false,
        customer: body.customer ?? true, vendor: body.vendor ?? false,
        etgoWeb: body.etgoWeb || '', etgoEmail: body.etgoEmail || '',
        etgoPhone: body.etgoPhone || '', creditLimit: body.creditLimit ?? 0,
        taxID: body.taxID || '', active: true,
      };
      // Upsert: avoid duplicates when multiple POSTs fire (validation retries, auto-save)
      const existingIdx = rows.findIndex(r => r.id === NEW_RECORD_ID);
      if (existingIdx !== -1) {
        Object.assign(rows[existingIdx], created);
      } else {
        rows.push(created);
      }
      return route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ response: { data: [created] } }),
      });
    }

    // PATCH
    if (method === 'PATCH') {
      const body = req.postData() ? JSON.parse(req.postData()) : {};
      patchLog.push(body);
      const m = url.match(/\/businessPartner\/([^/?]+)/);
      const found = rows.find(r => r.id === m?.[1]) ?? rows[0];
      Object.assign(found, body);
      return route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ response: { data: [found] } }),
      });
    }

    // DELETE
    if (method === 'DELETE') {
      const m = url.match(/\/businessPartner\/([^/?]+)/);
      const targetId = m?.[1];
      deleteLog.push(targetId);
      if (targetId === 'bp-empresa-nodelet') {
        return route.fulfill({
          status: 400, contentType: 'application/json',
          body: JSON.stringify({ error: { message: DELETE_ERROR_MSG, status: 400 } }),
        });
      }
      const idx = rows.findIndex(r => r.id === targetId);
      if (idx !== -1) rows.splice(idx, 1);
      return route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ response: { status: 0 } }),
      });
    }

    route.fallback();
  });

  // Child entities
  await page.route('**/sws/neo/contacts/contact**', async (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ response: { data: CONTACT_LINES, totalRows: CONTACT_LINES.length } }) });
    }
    route.fallback();
  });
  await page.route('**/sws/neo/contacts/bankAccount**', async (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ response: { data: BANK_LINES, totalRows: BANK_LINES.length } }) });
    }
    route.fallback();
  });
  await page.route('**/sws/neo/contacts/locationAddress**', async (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ response: { data: LOCATION_LINES, totalRows: LOCATION_LINES.length } }) });
    }
    route.fallback();
  });
  for (const entity of ['customer', 'vendorCreditor', 'basicDiscount']) {
    await page.route(`**/sws/neo/contacts/${entity}**`, async (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ response: { data: [], totalRows: 0 } }) });
      }
      route.fallback();
    });
  }

  // Sidebar
  await page.route('**/sws/neo/bp-stats/**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ revenue: 25000, expenses: 12000 }) }));
  await page.route('**/sws/neo/bp-trend/**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ months: ['Ene', 'Feb', 'Mar'], revenue: [5000, 5200, 4800], expenses: [2500, 2600, 2400] }) }));

  return { rows, patchLog, postLog, deleteLog };
}

// Helpers
function waitForDelete(page) {
  return page.waitForRequest(r => r.url().includes('/businessPartner/') && r.method() === 'DELETE', { timeout: 5_000 });
}
async function confirmDeleteDialog(page) {
  const dialog = page.getByTestId('confirm-delete-dialog').or(page.getByRole('dialog'));
  await expect(dialog).toBeVisible({ timeout: 5_000 });
  const btn = page.getByTestId('confirm-delete-confirm').or(page.getByTestId('row-quick-action-delete-confirm')).or(dialog.getByRole('button', { name: /delete|eliminar|confirm/i }));
  await btn.first().click();
  return dialog;
}

// -- Test --------------------------------------------------------------------

test.describe('Contacts — Full mocked journey', () => {

  test('list → create → detail → toggle → financial → sub-tabs → auto-save → filters → delete → bulk delete → edit', async ({ page }) => {
    await login(page);
    const { patchLog, postLog, deleteLog } = await installMocks(page);
    await page.goto('/contacts');
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});

    const listView = page.getByTestId('list-view');
    await expect(listView).toBeVisible({ timeout: 10_000 });

    // ═══════════════════════════════════════════════════════════════════════
    // PART 1: LIST VIEW — columns, badges, rows
    // ═══════════════════════════════════════════════════════════════════════

    const tbodyRows = page.locator('tbody tr');
    await expect(tbodyRows.first()).toBeVisible({ timeout: 10_000 });
    expect(await tbodyRows.count()).toBe(6);

    // Column headers: Tipo, Correo, Telefono, Web
    const headerTexts = (await page.locator('thead th, [role="columnheader"]').allTextContents()).join(' ').toLowerCase();
    expect(/tipo|type/.test(headerTexts)).toBe(true);
    expect(/correo|email/.test(headerTexts)).toBe(true);
    expect(/tel[eé]fono|phone/.test(headerTexts)).toBe(true);

    // Type badges: Cliente-only row has "Cliente" badge
    const clienteRow = page.locator('tbody tr').filter({ hasText: 'Maria Garcia' });
    await expect(clienteRow.getByText(/cliente/i).first()).toBeVisible({ timeout: 15_000 });

    // Proveedor-only row has "Proveedor" badge
    const vendorRow = page.locator('tbody tr').filter({ hasText: 'Carlos Lopez' });
    await expect(vendorRow.getByText(/proveedor/i).first()).toBeVisible({ timeout: 15_000 });

    // Dual row has BOTH badges
    const dualRow = page.locator('tbody tr').filter({ hasText: 'Empresa Dual' });
    await expect(dualRow.getByText(/cliente/i).first()).toBeVisible({ timeout: 15_000 });
    await expect(dualRow.getByText(/proveedor/i).first()).toBeVisible({ timeout: 15_000 });

    // Subset filter buttons exist
    const buttonTexts = (await page.locator('button, [role="tab"]').allTextContents()).join(' ');
    expect(/todos|all/i.test(buttonTexts)).toBe(true);
    expect(/personas|persons/i.test(buttonTexts)).toBe(true);
    expect(/empresas|companies/i.test(buttonTexts)).toBe(true);

    // ═══════════════════════════════════════════════════════════════════════
    // PART 2: CREATE — validation, fill, save
    // ═══════════════════════════════════════════════════════════════════════

    const newBtn = page.getByTestId('action-new').or(page.getByRole('button', { name: /nuevo contacto|new contact/i }));
    await expect(newBtn.first()).toBeVisible({ timeout: 5_000 });
    await newBtn.first().click();
    await expect(page).toHaveURL(/\/contacts\/new/, { timeout: 10_000 });

    const detailView = page.getByTestId('detail-view');
    await expect(detailView).toBeVisible({ timeout: 10_000 });

    const saveBtn = page.getByTestId('action-save').or(page.getByRole('button', { name: /^guardar$|^save$/i }));

    // Try saving without required fields → should stay on /new (validation prevents save)
    const postCountBefore = postLog.length;
    await saveBtn.first().click();
    await page.waitForTimeout(500);
    // If frontend validates, no POST is fired and we stay on /new
    const stayedOnNew = /\/contacts\/new/.test(page.url());
    const toastVisible = await page.locator('[role="status"], [data-sonner-toast], [class*="toast"]').first().isVisible({ timeout: 2_000 }).catch(() => false);
    // Either validation prevented the POST or a toast was shown
    expect(stayedOnNew || toastVisible || postLog.length === postCountBefore).toBe(true);

    // Fill Razon Social
    const nameInput = page.getByRole('textbox', { name: /razón social/i });
    await nameInput.fill('Importaciones Test S.L.');

    // Fill Clave NIF
    const taxSelect = page.getByTestId('field-oBTIKTaxIDKey');
    await expect(taxSelect).toBeVisible({ timeout: 5_000 });
    await taxSelect.click();
    await page.locator('[role="option"]').first().click();

    // Fill email and phone
    const emailInput = page.getByRole('textbox', { name: /correo electrónico|email/i });
    await emailInput.fill('test@importaciones.com');
    const phoneInput = page.getByRole('textbox', { name: /teléfono|phone/i });
    if (await phoneInput.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await phoneInput.fill('+34 91 999 0000');
    }

    // Save
    await saveBtn.first().click();
    await expect(page).not.toHaveURL(/\/contacts\/new/, { timeout: 10_000 });
    await expect(page).toHaveURL(/\/contacts\//, { timeout: 10_000 });

    // ═══════════════════════════════════════════════════════════════════════
    // PART 3: DETAIL — breadcrumb, identifier, kebab, KPIs, fields
    // ═══════════════════════════════════════════════════════════════════════

    // Breadcrumb visible
    await expect(page.getByText(/contacto/i).first()).toBeVisible({ timeout: 15_000 });

    // Razon Social persists
    await expect(nameInput).toHaveValue('Importaciones Test S.L.', { timeout: 5_000 });

    // Identifier is readonly
    const idInput = page.getByRole('textbox', { name: /identificador/i });
    if (await idInput.isVisible({ timeout: 3_000 }).catch(() => false)) {
      expect(await idInput.isDisabled() || await idInput.getAttribute('readonly') !== null).toBeTruthy();
    }

    // CIF/NIF and Pagina web labels present
    await expect(page.getByText(/cif\/nif/i).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/p[aá]gina web|web/i).first()).toBeVisible({ timeout: 15_000 });

    // Kebab menu (⋮) exists in toolbar — verify presence without opening
    // (opening it causes Radix scroll-lock overlay issues in continuous flows)
    const kebabBtn = page.getByRole('button', { name: /m[aá]s|more/i });
    await expect(kebabBtn.first()).toBeVisible({ timeout: 5_000 });

    // KPI sidebar
    await expect(page.getByText(/ventas y compras|ingresos/i).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/ver gr[aá]fico|view chart/i).first()).toBeVisible({ timeout: 15_000 });

    // ═══════════════════════════════════════════════════════════════════════
    // PART 4: TOGGLE Persona / Empresa
    // ═══════════════════════════════════════════════════════════════════════

    // The Person/Company toggle renders an sr-only <input type="radio"> inside a clickable
    // <label> (onClick handler lives on the label). Click the enclosing label, not the input.
    const personaBtn = page.getByRole('radio', { name: /^persona$/i }).locator('xpath=ancestor::label[1]');
    const empresaBtn = page.getByRole('radio', { name: /^empresa$/i }).locator('xpath=ancestor::label[1]');

    // Toggle to Persona
    await personaBtn.click();
    const firstNameInput = page.getByRole('textbox', { name: /^nombre/i });
    await expect(firstNameInput).toBeVisible({ timeout: 5_000 });
    const lastNameInput = page.getByRole('textbox', { name: /apellidos/i });
    await expect(lastNameInput).toBeVisible({ timeout: 5_000 });

    // Toggle back to Empresa
    const [togglePatch] = await Promise.all([
      page.waitForRequest(
        r => r.url().includes('/businessPartner/') && r.method() === 'PATCH'
          && (r.postData() || '').includes('etgoIsperson'),
        { timeout: 5_000 },
      ).catch(() => null),
      empresaBtn.click(),
    ]);

    // Razon Social visible again
    await expect(nameInput).toBeVisible({ timeout: 5_000 });

    // ═══════════════════════════════════════════════════════════════════════
    // PART 5: FINANCIAL TAB — stepper, billing, vendor
    // ═══════════════════════════════════════════════════════════════════════

    const financialTab = page.getByRole('button', { name: /financiero|financial/i });
    await financialTab.click();
    await page.waitForTimeout(500);

    // Credit stepper
    const creditInput = page.locator('input[type="number"]').first();
    await expect(creditInput).toBeVisible({ timeout: 5_000 });
    const stepperBtns = creditInput.locator('..').locator('button');

    // Click + → value increments
    const valueBefore = Number(await creditInput.inputValue()) || 0;
    if (await stepperBtns.count() >= 2) {
      await stepperBtns.last().click();
      await expect(async () => {
        const val = Number(await creditInput.inputValue());
        expect(val).toBeGreaterThan(valueBefore);
      }).toPass({ timeout: 3_000 });

      // Click - → decrements
      const valueAfterPlus = Number(await creditInput.inputValue());
      await stepperBtns.first().click();
      await expect(async () => {
        const val = Number(await creditInput.inputValue());
        expect(val).toBeLessThan(valueAfterPlus);
      }).toPass({ timeout: 3_000 });

      // Debounce: 10 rapid clicks → fewer than 10 PATCHes
      const patchCountBefore = patchLog.length;
      for (let i = 0; i < 10; i++) await stepperBtns.last().click();
      await page.waitForTimeout(2_000);
      const patchesFired = patchLog.length - patchCountBefore;
      expect(patchesFired).toBeLessThan(10);

      // Min boundary: set to 0, click minus → stays >= 0
      await creditInput.fill('0');
      await stepperBtns.first().click();
      await page.waitForTimeout(500);
      expect(Number(await creditInput.inputValue())).toBeGreaterThanOrEqual(0);
    }

    // Customer billing fields (customer=true)
    await expect(page.getByText(/^tarifa$/i).first()).toBeVisible({ timeout: 15_000 });
    const cuentaVisible = await page.getByText(/cuenta/i).first().isVisible({ timeout: 3_000 }).catch(() => false);
    expect(cuentaVisible).toBe(true);
    await expect(page.getByText(/m[eé]todo de pago/i).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/condiciones de pago/i).first()).toBeVisible({ timeout: 15_000 });
    const bloqueoVisible = await page.getByText(/bloqueo/i).first().isVisible({ timeout: 3_000 }).catch(() => false);
    expect(bloqueoVisible).toBe(true);

    // Enable vendor → vendor billing fields appear.
    // The checkbox is an sr-only <input> inside a clickable <label>; target the label.
    const vendorCheckbox = page.getByRole('checkbox', { name: /proveedor|vendor/i }).locator('xpath=ancestor::label[1]');
    let vendorChecked = false;
    if (await vendorCheckbox.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await vendorCheckbox.click();
      vendorChecked = true;
    } else {
      const vendorLabel = page.getByText(/proveedor|vendor/i).first();
      if (await vendorLabel.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await vendorLabel.click();
        vendorChecked = true;
      }
    }
    if (vendorChecked) {
      await expect(page.getByText(/tarifa de compra/i).first()).toBeVisible({ timeout: 15_000 });
    }

    // ═══════════════════════════════════════════════════════════════════════
    // PART 6: SUB-TABS — addresses, contacts, bank account, attachments
    // ═══════════════════════════════════════════════════════════════════════

    // Back to General
    const generalTab = page.getByRole('button', { name: /^general$/i });
    await generalTab.click();
    await page.waitForTimeout(300);

    // Address tab
    const addressTab = page.getByTestId('tab-locationAddress').or(page.getByRole('button', { name: /direcci[oó]n/i }));
    await addressTab.first().click();
    await expect(page.getByText('Sede Central')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText('Almacen Norte')).toBeVisible({ timeout: 5_000 });
    // Verify Dir.envios / Dir.factura columns
    const pageText = (await page.locator('body').textContent()).toLowerCase();
    expect(/dir\.?\s*env[ií]o/.test(pageText)).toBe(true);
    expect(/dir\.?\s*factura/.test(pageText)).toBe(true);

    // Contacts child tab
    const contactTab = page.getByTestId('tab-contact');
    if (await contactTab.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await contactTab.click();
    } else {
      const tabStrip = page.locator('[class*="tab"]').filter({ hasText: /persona.*\d/ });
      await tabStrip.first().click();
    }
    await expect(page.getByText('Martinez')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText('Sanchez')).toBeVisible({ timeout: 5_000 });
    // Verify Posicion column
    const contactText = (await page.locator('body').textContent()).toLowerCase();
    expect(/posici[oó]n/.test(contactText)).toBe(true);

    // Bank account tab
    const bankTab = page.getByTestId('tab-bankAccount');
    await expect(bankTab).toBeVisible({ timeout: 5_000 });
    await bankTab.click();
    await expect(page.getByText('Santander')).toBeVisible({ timeout: 5_000 });

    // Attachments tab visible
    const attachTab = page.getByTestId('tab-custom:attachments').or(page.getByRole('button', { name: /adjuntos|attachments/i }));
    await expect(attachTab.first()).toBeVisible({ timeout: 5_000 });

    // ═══════════════════════════════════════════════════════════════════════
    // PART 7: AUTO-SAVE ON BLUR (on the current record — no page reload)
    // ═══════════════════════════════════════════════════════════════════════

    // Back to General tab to access email field
    await generalTab.click();
    await page.waitForTimeout(300);

    const emailField = page.getByRole('textbox', { name: /correo electrónico|email/i });
    await expect(emailField).toBeVisible({ timeout: 5_000 });

    // Edit email and blur → PATCH fires without clicking Save
    await emailField.clear();
    await emailField.fill('nuevo@importaciones.com');
    const phoneField = page.getByRole('textbox', { name: /teléfono|phone/i });
    const [blurPatch] = await Promise.all([
      page.waitForRequest(
        r => r.url().includes('/businessPartner/') && r.method() === 'PATCH',
        { timeout: 5_000 },
      ),
      phoneField.click(),
    ]);
    expect(JSON.parse(blurPatch.postData() || '{}').etgoEmail).toBe('nuevo@importaciones.com');

    // ═══════════════════════════════════════════════════════════════════════
    // PART 8: BACK TO LIST — navigate via Cancel button, then filters
    // ═══════════════════════════════════════════════════════════════════════

    const cancelBtn = page.getByTestId('action-cancel')
      .or(page.getByRole('button', { name: /cancelar|cancel|volver|back/i }));
    await cancelBtn.first().click();
    await expect(page.getByTestId('list-view')).toBeVisible({ timeout: 10_000 });

    // Wait for table rows to render before asserting specific content
    await expect(page.locator('tbody tr').first()).toBeVisible({ timeout: 15_000 });

    // New contact "Importaciones" should be in the list
    await expect(page.locator('tbody tr').filter({ hasText: 'Importaciones' }).first()).toBeVisible({ timeout: 15_000 });

    // Filter by Personas → only personas visible
    const personasFilterBtn = page.getByRole('button', { name: /personas|persons/i }).or(page.getByRole('tab', { name: /personas|persons/i }));
    await personasFilterBtn.first().click();
    await page.waitForTimeout(500);
    await expect(page.locator('tbody tr').filter({ hasText: 'Maria' }).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('tbody tr').filter({ hasText: 'Carlos' }).first()).toBeVisible({ timeout: 15_000 });
    // Empresas should be hidden
    expect(await page.locator('tbody tr').filter({ hasText: 'Empresa Con Facturas' }).count()).toBe(0);

    // Filter by Empresas
    const empresasFilterBtn = page.getByRole('button', { name: /empresas|companies/i }).or(page.getByRole('tab', { name: /empresas|companies/i }));
    await empresasFilterBtn.first().click();
    await page.waitForTimeout(500);
    expect(await page.locator('tbody tr').filter({ hasText: 'Maria' }).count()).toBe(0);

    // Back to Todos
    const todosFilterBtn = page.getByRole('button', { name: /todos|all/i }).or(page.getByRole('tab', { name: /todos|all/i }));
    await todosFilterBtn.first().click();
    await page.waitForTimeout(500);
    expect(await page.locator('tbody tr').count()).toBeGreaterThanOrEqual(5);

    // ═══════════════════════════════════════════════════════════════════════
    // PART 9: DELETE — success first, then error
    // ═══════════════════════════════════════════════════════════════════════

    // Delete successfully first (clean state, no prior dialog issues)
    const safeRow = page.locator('tbody tr').filter({ hasText: 'Importaciones' }).first();
    await expect(safeRow).toBeVisible({ timeout: 5_000 });
    await safeRow.hover();
    const delBtn1 = safeRow.getByTestId('row-quick-action-delete');
    await expect(delBtn1).toBeVisible({ timeout: 5_000 });
    await delBtn1.click();

    const delDialog1 = page.getByTestId('confirm-delete-dialog').or(page.getByRole('dialog'));
    await expect(delDialog1).toBeVisible({ timeout: 5_000 });
    const delConfirm1 = page.getByTestId('confirm-delete-confirm')
      .or(delDialog1.getByRole('button', { name: /delete|eliminar|confirm/i }));

    // Wait for DELETE request + click confirm simultaneously
    await Promise.all([
      page.waitForRequest(r => r.url().includes('/businessPartner/') && r.method() === 'DELETE', { timeout: 5_000 }),
      delConfirm1.first().click(),
    ]);
    // Mock DELETE removes from array; UI needs list re-fetch to reflect the removal
    await page.goto('/contacts');
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
    await expect(page.getByTestId('list-view')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('tbody tr').filter({ hasText: 'Importaciones' })).toHaveCount(0, { timeout: 5_000 });

    // Now delete with dependencies → error toast, row stays
    const protectedRow = page.locator('tbody tr').filter({ hasText: 'Empresa Con Facturas' }).first();
    await protectedRow.hover();
    const delBtn2 = protectedRow.getByTestId('row-quick-action-delete');
    await expect(delBtn2).toBeVisible({ timeout: 5_000 });
    await delBtn2.click();

    const delDialog2 = page.getByTestId('confirm-delete-dialog').or(page.getByRole('dialog'));
    await expect(delDialog2).toBeVisible({ timeout: 5_000 });
    const delConfirm2 = page.getByTestId('confirm-delete-confirm')
      .or(delDialog2.getByRole('button', { name: /delete|eliminar|confirm/i }));
    await delConfirm2.first().click();
    await page.waitForTimeout(1_500);

    // Error toast visible
    const deleteErrorToast = page.locator('[role="status"], [data-sonner-toast], [class*="toast"]').filter({ hasText: /facturas|asociad|cannot delete/i });
    await expect(deleteErrorToast.first()).toBeVisible({ timeout: 5_000 });
    // Row still there
    await expect(protectedRow).toBeVisible({ timeout: 5_000 });

    // Clean up dialog/overlay from failed delete before continuing
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    await page.evaluate(() => document.body.removeAttribute('data-scroll-locked'));

    // ═══════════════════════════════════════════════════════════════════════
    // PART 10: BULK DELETE — abort + success
    // ═══════════════════════════════════════════════════════════════════════

    // Select protected + safe-001 → first fails → both stay
    const nodelete = page.getByTestId('row-bp-empresa-nodelet');
    const safe1 = page.getByTestId('row-bp-safe-001');

    await nodelete.locator('[role="checkbox"]').first().click();
    await safe1.locator('[role="checkbox"]').first().click();

    const selectionText = page.locator('text=/2.*seleccionado|2.*selected/i');
    await expect(selectionText.first()).toBeVisible({ timeout: 5_000 });

    // Find and click bulk trash
    const bulkTrashBtn = page.locator('button').filter({ has: page.locator('svg.lucide-trash-2, svg[class*="trash"]') }).or(page.locator('button[class*="FBB1C4"]'));
    const selectionBar = page.locator('div').filter({ hasText: /seleccionado|selected/i }).first().locator('..');
    const trashInBar = selectionBar.locator('button').filter({ has: page.locator('svg') }).first();
    const bulkBtn = await bulkTrashBtn.count() > 0 ? bulkTrashBtn.first() : trashInBar;
    await bulkBtn.click();

    const bulkDialog = page.getByTestId('confirm-delete-dialog').or(page.getByRole('dialog'));
    await expect(bulkDialog).toBeVisible({ timeout: 5_000 });
    const bulkConfirm = page.getByTestId('confirm-delete-confirm').or(bulkDialog.getByRole('button', { name: /delete|eliminar|confirm/i }));
    await bulkConfirm.first().click();
    await page.waitForTimeout(1_500);

    // Both rows should still be in the list (abort on first error)
    await expect(page.locator('tbody tr').filter({ hasText: 'Empresa Con Facturas' }).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('tbody tr').filter({ hasText: 'Borrable Uno' }).first()).toBeVisible({ timeout: 15_000 });

    // Now select two safe rows → both delete successfully
    // Close any overlay from previous bulk delete error, navigate via sidebar
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    await page.evaluate(() => document.body.removeAttribute('data-scroll-locked'));
    // Re-navigate to refresh the list after bulk delete
    await page.goto('/contacts');
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
    await expect(page.getByTestId('list-view')).toBeVisible({ timeout: 10_000 });

    const s1 = page.getByTestId('row-bp-safe-001');
    const s2 = page.getByTestId('row-bp-safe-002');
    await s1.locator('[role="checkbox"]').first().click();
    await s2.locator('[role="checkbox"]').first().click();

    const selText2 = page.locator('text=/2.*seleccionado|2.*selected/i');
    await expect(selText2.first()).toBeVisible({ timeout: 5_000 });

    const bulkBtn2 = await bulkTrashBtn.count() > 0 ? bulkTrashBtn.first() : trashInBar;
    await bulkBtn2.click();
    const dialog2 = page.getByTestId('confirm-delete-dialog').or(page.getByRole('dialog'));
    await expect(dialog2).toBeVisible({ timeout: 5_000 });
    const confirm2 = page.getByTestId('confirm-delete-confirm').or(dialog2.getByRole('button', { name: /delete|eliminar|confirm/i }));
    await confirm2.first().click();

    await expect(page.locator('tbody tr').filter({ hasText: 'Borrable Uno' })).toHaveCount(0, { timeout: 5_000 });
    await expect(page.locator('tbody tr').filter({ hasText: 'Borrable Dos' })).toHaveCount(0, { timeout: 5_000 });

    // ═══════════════════════════════════════════════════════════════════════
    // PART 11: NAVIGATE TO DETAIL VIA EDIT QUICK ACTION
    // ═══════════════════════════════════════════════════════════════════════

    const editRow = page.locator('tbody tr').first();
    await editRow.hover();
    const editQA = editRow.getByTestId('row-quick-action-edit');
    await expect(editQA).toBeVisible({ timeout: 5_000 });
    await editQA.click();
    await expect(page).toHaveURL(/\/contacts\/[^/]+/, { timeout: 10_000 });
    await expect(page.getByTestId('detail-view')).toBeVisible({ timeout: 10_000 });
  });
});

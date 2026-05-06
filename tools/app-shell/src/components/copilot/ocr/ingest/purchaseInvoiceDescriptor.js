import { simSearch } from '@/lib/simSearch';
import { deriveContactsApiBase } from '../contactApi';

/**
 * Translate the vision-LLM extracted JSON for a purchase invoice into a list
 * of batch operations.
 *
 * The descriptor is the only per-window code: it decides what to look up
 * client-side, when to ask the user (typically via {@code askUserForBp}), and
 * how to thread refs between operations. The server's role is just to run
 * what we hand it inside one transaction.
 *
 * Returns either:
 *   - {@code { ops: [...] }} ready to POST to {@code /sws/neo/batch}, or
 *   - {@code { cancelled: true }} when the user dismissed a required popup.
 */
function nonBlank(value) {
  return value != null && String(value).trim() !== '';
}

function toIsoDate(value) {
  if (!value) return null;
  const trimmed = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const m = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (!m) return trimmed;
  const day = m[1].padStart(2, '0');
  const month = m[2].padStart(2, '0');
  const year = m[3].length === 2 ? `20${m[3]}` : m[3];
  return `${year}-${month}-${day}`;
}

/**
 * Fetch the BP's first active location id. The invoice header requires
 * partnerAddress (C_BPartner_Location_ID) NOT NULL, and the SE_Invoice_BPartner
 * callout only sets it when the BP has a primary location flagged in a way the
 * callout recognizes — which isn't reliable through /batch. So we resolve it
 * client-side and embed it in the header body.
 */
async function findBpLocation({ token, apiBaseUrl, bpId }) {
  if (!apiBaseUrl || !token || !bpId) return null;
  const contactsBase = apiBaseUrl.replace(/\/[^/]+$/, '/contacts');
  const where = encodeURIComponent(`businessPartner.id = '${bpId}' and active = true`);
  const url = `${contactsBase}/locationAddress?_neoWhere=${where}&limit=1`;
  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) {
      console.warn('[OCR][findBpLocation] non-OK', res.status, url);
      return null;
    }
    const json = await res.json().catch(() => null);
    const data = json?.response?.data ?? json?.data ?? [];
    return data[0]?.id || null;
  } catch (e) {
    console.warn('[OCR][findBpLocation] fetch failed', e);
    return null;
  }
}

/**
 * Look up an existing BusinessPartner by taxID then name, using the contacts
 * spec selector. Returns the BP id when a single active match is found,
 * otherwise null. Multiple-candidate disambiguation is intentionally left to
 * the popup — by the time we trigger it the user is already in the loop.
 */
async function findBp({ token, apiBaseUrl, taxId, name }) {
  if (!apiBaseUrl || !token) return null;
  // apiBaseUrl points at the host spec (e.g. /sws/neo/purchase-invoice).
  // The contacts spec lives at the sibling /sws/neo/contacts; derive it the
  // same way ContactCreatePopup does so we hit a real endpoint, not the
  // host spec's nested path.
  const contactsBase = deriveContactsApiBase(apiBaseUrl);

  const tryQuery = async (property, value) => {
    if (!nonBlank(value)) return null;
    // NEO's NeoCrudHandler accepts `_neoWhere` as an extra HQL fragment
    // appended to the tab filter. Plain `?name=...` query params don't
    // reliably map to DAL field filters here, so we use the explicit clause.
    // Property names are HQL (DAL) properties, not DB columns: `taxID`, `name`,
    // `active`. Single quotes are escaped per HQL convention.
    const escaped = String(value).replace(/'/g, "''");
    const where = encodeURIComponent(`${property} = '${escaped}' and active = true`);
    const url = `${contactsBase}/businessPartner?_neoWhere=${where}`;
    try {
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) {
        console.warn('[OCR][findBp] non-OK', res.status, url);
        return null;
      }
      const json = await res.json().catch(() => null);
      const data = json?.response?.data ?? json?.data ?? [];
      console.log('[OCR][findBp]', property, '=', value, '→', data.length, 'match(es)');
      // Only resolve when exactly one row matches — multiple matches surface
      // the popup so the user can disambiguate.
      return data.length === 1 ? data[0]?.id : null;
    } catch (e) {
      console.warn('[OCR][findBp] fetch failed', e);
      return null;
    }
  };

  return (await tryQuery('taxID', taxId)) || (await tryQuery('name', name)) || null;
}

export async function buildPurchaseInvoiceBatch(extracted, ctx) {
  const safe = extracted || {};
  const lines = Array.isArray(safe.line_items) ? safe.line_items : [];
  const { token, apiBaseUrl, askUserForBp, askUserForProducts } = ctx || {};

  // 1. Resolve products (client-side simSearch — same logic as today).
  const productHints = lines.map(l => String(l?.description ?? '').trim());
  let productMatches = [];
  if (token && productHints.length > 0) {
    productMatches = await simSearch({
      token,
      entityName: 'Product',
      items: productHints,
      minSimPercent: 30,
      qtyResults: 1,
    });
  }

  // 2. Try to find the vendor; if missing, ask the user via the popup.
  let bpId = await findBp({
    token,
    apiBaseUrl,
    taxId: safe.tax_id,
    name: safe.vendor_name,
  });

  let bpCreate = null;
  let locationCreate = null;
  if (!bpId && typeof askUserForBp === 'function') {
    const fields = await askUserForBp({
      prefilled: {
        name: safe.vendor_name || '',
        taxId: safe.tax_id || '',
        phone: safe.vendor_phone || '',
        email: safe.vendor_email || '',
        addressLine1: safe.vendor_address || '',
      },
    });
    if (!fields) {
      return { cancelled: true };
    }
    const { location, ...bpFields } = fields;
    bpCreate = {
      id: 'bp',
      spec: 'contacts',
      entity: 'businessPartner',
      body: bpFields,
    };
    if (location) {
      locationCreate = {
        id: 'loc',
        spec: 'contacts',
        entity: 'locationAddress',
        parentRef: 'bp',
        body: { ...location, businessPartner: '$ref:bp' },
      };
    }
  }

  // 3. Assemble the batch.
  const ops = [];
  if (bpCreate) ops.push(bpCreate);
  if (locationCreate) ops.push(locationCreate);

  // partnerAddress is NOT NULL on C_Invoice. For a freshly-created BP it
  // points at the location op via $ref; for an existing BP we look up the
  // BP's first active location ourselves (the SE_Invoice_BPartner callout
  // doesn't reliably populate it through the /batch path).
  let partnerAddress = null;
  if (bpId) {
    partnerAddress = await findBpLocation({ token, apiBaseUrl, bpId });
  } else if (locationCreate) {
    partnerAddress = '$ref:loc';
  }

  const headerBody = {};
  if (nonBlank(safe.document_no)) headerBody.documentNo = String(safe.document_no).trim();
  if (nonBlank(safe.invoice_date)) headerBody.invoiceDate = toIsoDate(safe.invoice_date);
  headerBody.businessPartner = bpId || '$ref:bp';
  if (partnerAddress) headerBody.partnerAddress = partnerAddress;

  ops.push({
    id: 'inv',
    spec: 'purchase-invoice',
    entity: 'Header',
    body: headerBody,
  });

  // Resolve the product for every line. simSearch handles the obvious matches;
  // anything left over goes through the resolver popup so the user can pick.
  // The DB trigger c_invline_chk_restrictions_trg rejects rows where
  // M_Product_ID is null with @InvoiceLineAmountMustBeZero@, so a still-
  // unresolved line is dropped from the batch — the user can add it manually.
  const productByIdx = {};
  const needsUserPick = [];
  lines.forEach((line, idx) => {
    const id = productMatches[idx]?.id;
    if (id) {
      productByIdx[idx] = id;
    } else {
      needsUserPick.push({
        idx,
        description: String(line?.description ?? `line ${idx + 1}`).trim(),
        quantity: nonBlank(line?.quantity) ? Number(line.quantity) : null,
        unitPrice: nonBlank(line?.unit_price) ? Number(line.unit_price) : null,
      });
    }
  });

  if (needsUserPick.length > 0 && typeof askUserForProducts === 'function') {
    // Sibling product spec — same shape used in ContactCreatePopup for the
    // contacts spec (`/sws/neo/<host>` → `/sws/neo/product`).
    const productSpecUrl = apiBaseUrl ? apiBaseUrl.replace(/\/[^/]+$/, '/product') : null;
    // Use the standalone product entity list rather than the line-context
    // selector. The line selector (`${apiBaseUrl}/lines/selectors/M_Product_ID`)
    // is narrowed by the parent invoice's price list, which we don't have at
    // OCR time — so it returned only the 4 products in the org default list.
    const selectorUrl = productSpecUrl ? `${productSpecUrl}/product` : null;
    const picks = await askUserForProducts({ unmatched: needsUserPick, selectorUrl, productSpecUrl });
    if (picks === null) {
      return { cancelled: true };
    }
    for (const [idxStr, productId] of Object.entries(picks || {})) {
      if (productId) productByIdx[Number(idxStr)] = productId;
    }
  }

  const unmatched = [];
  lines.forEach((line, idx) => {
    const productId = productByIdx[idx];
    if (!productId) {
      unmatched.push(String(line?.description ?? `line ${idx + 1}`).trim());
      return;
    }
    const body = { product: productId };
    if (nonBlank(line?.quantity)) body.invoicedQuantity = Number(line.quantity);
    if (nonBlank(line?.unit_price)) body.unitPrice = Number(line.unit_price);
    ops.push({
      id: `ln${idx}`,
      spec: 'purchase-invoice',
      entity: 'Lines',
      parentRef: 'inv',
      body,
    });
  });

  return { ops, unmatched };
}

export default buildPurchaseInvoiceBatch;

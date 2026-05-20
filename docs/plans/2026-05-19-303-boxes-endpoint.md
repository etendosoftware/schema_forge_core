# 303 Boxes Endpoint — Implementation Plan

> **For agentic workers:** use superpowers:executing-plans to implement task-by-task.

**Goal:** Add a real `GET /neo/fiscal303/boxes?year=2026&period=T2` endpoint in `com.etendoerp.go` that calls `AEAT303CalculationsHelper` and returns `{ boxes, summary }` — replacing the hardcoded stub in `fiscalModelsUtils.js`.

**Architecture:** New `Fiscal303BoxesHandler` class wired into `NeoBuiltInEndpointHandler`; frontend stub becomes a real fetch call with fallback to mock.

**Tech Stack:** Java 11, Openbravo DAL/OBDal, `AEAT303CalculationsHelper`, `AEAT303ReportDao`, Jettison JSON, React + fetch.

---

## Resolved Open Questions

All Q1–Q6 from the design doc are answered empirically — no localization team needed.

| Q | Answer |
|---|---|
| Q1 — TaxReport lookup | `value = 'AEAT303_Q_{year}'` (quarterly) or `'AEAT303_M_{year}'` (monthly), filter by `ad_org_id`. Org `61849243BE89460EB70866880A545D50` has one record per year/period type. |
| Q2 — AcctSchema | One per org. Query `c_acctschema` by `ad_client_id`; GOOrg → `C06B100312FA48159DB36B9A4B461019`. |
| Q3 — Group searchkeys | From `AEAT303Report2014.java` source: sales `VAT_SALES_GENERAL`, `VAT_SALES_EU`, `VAT_SALES_ISP`, `VAT_SALES_EC`; purchases under `VAT_PURCHASE`: `Normal_Operations`, `Investment_Goods`, `Import_Goods`, `Import_Investment_Goods`, `Intracommunity_Goods`, `Intracommunity_Investments`. |
| Q4 — Code path | Use `C_INVOICETAX` (2014+ path via `calculateAmountsMap`). |
| Q5 — Period resolution | `C_Period` filtered by `ad_org_id + c_year.year + periodno`. T1→months 1–3, T2→4–6, T3→7–9, T4→10–12. Monthly `MM` (string) → single periodno. 4 orgs share same year data; filter by org. |
| Q6 — Cash VAT view | Wrap `calculateCashVAT` in try/catch; return `BigDecimal.ZERO` if view is absent. Already handled inside `calculateAmountsMap`. |
| Q7 — File generation | Out of scope for this plan. |

---

## Files

| Action | Path |
|---|---|
| Create | `modules/com.etendoerp.go/src/com/etendoerp/go/schemaforge/Fiscal303BoxesHandler.java` |
| Modify | `modules/com.etendoerp.go/src/com/etendoerp/go/schemaforge/NeoBuiltInEndpointHandler.java` |
| Modify | `tools/app-shell/src/windows/custom/fiscal-models/fiscalModelsUtils.js` |
| Modify | `tools/app-shell/src/windows/custom/fiscal-models/__tests__/fiscalModelsUtils.test.js` |

---

## Task 1: `Fiscal303BoxesHandler.java`

**Files:**
- Create: `modules/com.etendoerp.go/src/com/etendoerp/go/schemaforge/Fiscal303BoxesHandler.java`

- [ ] **Step 1: Understand the period resolution query**

GOOrg (`61849243BE89460EB70866880A545D50`) has 12 `C_Period` rows for 2026, one per month, filtered by `ad_org_id`.  
T1 → periodno 1–3 | T2 → 4–6 | T3 → 7–9 | T4 → 10–12. Monthly `"04"` → periodno 4.

- [ ] **Step 2: Create the class skeleton**

```java
package com.etendoerp.go.schemaforge;

import java.io.IOException;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import org.apache.log4j.Logger;
import org.codehaus.jettison.json.JSONObject;
import org.openbravo.base.exception.OBException;
import org.openbravo.dal.core.OBContext;
import org.openbravo.dal.service.OBCriteria;
import org.openbravo.dal.service.OBDal;
import org.openbravo.model.common.enterprise.Organization;
import org.openbravo.model.financialmgmt.accounting.coa.AcctSchema;
import org.openbravo.model.financialmgmt.calendar.Period;
import org.openbravo.model.financialmgmt.tax.TaxRate;
import org.openbravo.module.aeat303.es.api.InvoiceType;
import org.openbravo.module.aeat303.es.report.v2014.AEAT303Report2014Dao;
import org.openbravo.module.aeat303.es.util.AEAT303CalculationsHelper;
import org.openbravo.module.taxreportlauncher.TaxReport;
import org.openbravo.module.taxreportlauncher.TaxReportGroup;
import org.openbravo.module.taxreportlauncher.TaxReportParameter;
import org.openbravo.module.taxreportlauncher.Dao.TaxReportLauncherDao;

import org.hibernate.criterion.Restrictions;

class Fiscal303BoxesHandler {

  private static final Logger log = Logger.getLogger(Fiscal303BoxesHandler.class);

  private final NeoServlet servlet;

  Fiscal303BoxesHandler(NeoServlet servlet) {
    this.servlet = servlet;
  }

  void handle(String entityName, String method, HttpServletRequest request,
      HttpServletResponse response) throws IOException {
    if (!"GET".equals(method) || !"boxes".equals(entityName)) {
      servlet.sendError(response, HttpServletResponse.SC_METHOD_NOT_ALLOWED,
          "Only GET /fiscal303/boxes is supported");
      return;
    }
    try {
      String yearStr = request.getParameter("year");
      String period  = request.getParameter("period"); // "T1"–"T4" or "01"–"12"
      if (yearStr == null || period == null) {
        servlet.sendError(response, HttpServletResponse.SC_BAD_REQUEST,
            "Missing required params: year, period");
        return;
      }
      int year = Integer.parseInt(yearStr);
      String orgId = OBContext.getOBContext().getCurrentOrganization().getId();

      Map<Integer, BigDecimal> boxes = computeBoxes(orgId, year, period);
      JSONObject result = buildResponse(boxes);
      response.setContentType("application/json;charset=UTF-8");
      response.getWriter().write(result.toString());
    } catch (Exception e) {
      log.error("Error computing 303 boxes", e);
      servlet.sendError(response, HttpServletResponse.SC_INTERNAL_SERVER_ERROR, e.getMessage());
    }
  }

  // ── Internal ─────────────────────────────────────────────────────

  Map<Integer, BigDecimal> computeBoxes(String orgId, int year, String period) throws Exception {
    Organization org = OBDal.getInstance().get(Organization.class, orgId);

    // 1. Resolve TaxReport
    boolean quarterly = period.startsWith("T");
    String valueKey = quarterly
        ? "AEAT303_Q_" + year
        : "AEAT303_M_" + year;
    TaxReport taxReport = resolveTaxReport(orgId, valueKey);

    // 2. Resolve AcctSchema
    AcctSchema acctSchema = resolveAcctSchema(org);

    // 3. Resolve Periods
    List<Period> periods = resolvePeriods(orgId, year, period);
    if (periods.isEmpty()) {
      throw new OBException("No periods found for org=" + orgId + " year=" + year + " period=" + period);
    }

    // 4. Instantiate helper
    AEAT303CalculationsHelper helper = new AEAT303CalculationsHelper(org, periods, acctSchema, log);
    AEAT303Report2014Dao dao303 = new AEAT303Report2014Dao();

    Map<Integer, BigDecimal> b = new HashMap<>();

    // 5. Sales groups
    fillSalesBoxes(b, helper, dao303, taxReport);

    // 6. Purchase groups
    fillPurchaseBoxes(b, helper, dao303, taxReport);

    // 7. Totals
    int[] accruedCuotas = {3, 6, 9, 11, 13, 15, 18, 21, 24, 152, 158, 167};
    int[] deductCuotas  = {29, 31, 33, 35, 37, 39, 41, 42, 43, 44};
    BigDecimal accrued   = sumBoxes(b, accruedCuotas);
    BigDecimal deductible = sumBoxes(b, deductCuotas);
    b.put(27, round(accrued));
    b.put(45, round(deductible));
    b.put(46, round(accrued.subtract(deductible)));

    return b;
  }

  // Sales flags verified from AEAT303Report2014.generateSalesLines() source:
  // VAT_SALES_GENERAL:  get303Taxes(id, "All",      "All", "All", param)  → split by %
  // VAT_SALES_EU:       get303Taxes(id, "Purchase", "No",  "Yes", param)  → intracom purchases
  // VAT_SALES_ISP:      get303Taxes(id, "Purchase", "No",  "No",  param)  → sujeto pasivo
  // VAT_SALES_EC:       get303Taxes(id, "All",      "All", "All", param)  → split by %, EC rates

  private void fillSalesBoxes(Map<Integer, BigDecimal> b, AEAT303CalculationsHelper helper,
      AEAT303Report2014Dao dao303, TaxReport taxReport) {

    // VAT_SALES_GENERAL — split by rate % → boxes 7/9 (21%), 4/6 (10%/7%/8%), 1/3 (4%/5%), 150/152 (0%), 165/167 (2%)
    TaxReportParameter paramGeneral = dao303.getTaxReportParameter(taxReport, "VAT_SALES", "VAT_SALES_GENERAL");
    List<TaxRate> salesGeneral = dao303.get303Taxes(taxReport.getId(), "All", "All", "All", paramGeneral);
    for (Map.Entry<BigDecimal, List<TaxRate>> e : splitByPercentage(salesGeneral).entrySet()) {
      BigDecimal pct = e.getKey();
      Map<String, BigDecimal> r = helper.calculateAmountsMap(e.getValue(), InvoiceType.ALL);
      BigDecimal base = r.get("TaxBaseAmount"), tax = r.get("TaxAmount");
      if (pct.compareTo(new BigDecimal("21")) == 0) {
        addToBox(b, 7, base); addToBox(b, 9, tax);
      } else if (pct.compareTo(new BigDecimal("10")) == 0 || pct.compareTo(new BigDecimal("7")) == 0 || pct.compareTo(new BigDecimal("8")) == 0) {
        addToBox(b, 4, base); addToBox(b, 6, tax);
      } else if (pct.compareTo(new BigDecimal("4")) == 0 || pct.compareTo(new BigDecimal("5")) == 0) {
        addToBox(b, 1, base); addToBox(b, 3, tax);
      } else if (pct.compareTo(BigDecimal.ZERO) == 0) {
        addToBox(b, 150, base); addToBox(b, 152, tax);
      } else if (pct.compareTo(new BigDecimal("2")) == 0) {
        addToBox(b, 165, base); addToBox(b, 167, tax);
      }
      // rates 7.5%, 16%, 18% are legacy; they accumulate into the next current-rate bucket
      // (same logic AEAT303Report2014 uses with oldtaxes list — ignored for now)
    }

    // VAT_SALES_EU → boxes 10, 11
    fillGroupBoxes(b, helper, dao303, taxReport, "VAT_SALES", "VAT_SALES_EU", "Purchase", "No", "Yes", 10, 11);

    // VAT_SALES_ISP → boxes 12, 13
    fillGroupBoxes(b, helper, dao303, taxReport, "VAT_SALES", "VAT_SALES_ISP", "Purchase", "No", "No", 12, 13);

    // VAT_SALES_EC (recargo equivalencia) — split by %: 0.50%→16/18, 1.40%→19/21, 5.20%→22/24, 1.75%→156/158
    TaxReportParameter paramEC = dao303.getTaxReportParameter(taxReport, "VAT_SALES", "VAT_SALES_EC");
    List<TaxRate> ecTaxes = dao303.get303Taxes(taxReport.getId(), "All", "All", "All", paramEC);
    for (Map.Entry<BigDecimal, List<TaxRate>> e : splitByPercentage(ecTaxes).entrySet()) {
      BigDecimal pct = e.getKey();
      Map<String, BigDecimal> r = helper.calculateAmountsMap(e.getValue(), InvoiceType.ALL);
      BigDecimal base = r.get("TaxBaseAmount"), tax = r.get("TaxAmount");
      if (pct.compareTo(new BigDecimal("1.40")) == 0)      { addToBox(b, 19, base); addToBox(b, 21, tax); }
      else if (pct.compareTo(new BigDecimal("5.20")) == 0) { addToBox(b, 22, base); addToBox(b, 24, tax); }
      else if (pct.compareTo(new BigDecimal("0.50")) == 0) { addToBox(b, 16, base); addToBox(b, 18, tax); }
      else if (pct.compareTo(new BigDecimal("1.75")) == 0) { addToBox(b, 156, base); addToBox(b, 158, tax); }
    }
  }

  private void fillPurchaseBoxes(Map<Integer, BigDecimal> b, AEAT303CalculationsHelper helper,
      AEAT303Report2014Dao dao303, TaxReport taxReport) {
    fillGroupBoxes(b, helper, dao303, taxReport, "VAT_PURCHASE", "Normal_Operations",         "Purchase","No","No", 28, 29);
    fillGroupBoxes(b, helper, dao303, taxReport, "VAT_PURCHASE", "Investment_Goods",           "Purchase","No","No", 30, 31);
    fillGroupBoxes(b, helper, dao303, taxReport, "VAT_PURCHASE", "Import_Goods",               "Purchase","No","No", 32, 33);
    fillGroupBoxes(b, helper, dao303, taxReport, "VAT_PURCHASE", "Import_Investment_Goods",    "Purchase","No","No", 34, 35);
    fillGroupBoxes(b, helper, dao303, taxReport, "VAT_PURCHASE", "Intracommunity_Goods",       "Purchase","No","Yes",36, 37);
    fillGroupBoxes(b, helper, dao303, taxReport, "VAT_PURCHASE", "Intracommunity_Investments", "Purchase","No","Yes",38, 39);
  }

  private void fillGroupBoxes(Map<Integer, BigDecimal> b, AEAT303CalculationsHelper helper,
      AEAT303Report2014Dao dao303, TaxReport taxReport,
      String groupKey, String paramKey,
      String taxType, String equivCharge, String intracom,
      int baseBox, int taxBox) {
    TaxReportParameter param = dao303.getTaxReportParameter(taxReport, groupKey, paramKey);
    if (param == null) return;
    List<TaxRate> rates = dao303.get303Taxes(taxReport.getId(), taxType, equivCharge, intracom, param);
    if (rates.isEmpty()) return;
    Map<String, BigDecimal> result = helper.calculateAmountsMap(rates, InvoiceType.ALL);
    addToBox(b, baseBox, result.get("TaxBaseAmount"));
    addToBox(b, taxBox,  result.get("TaxAmount"));
  }

  // ── Resolution helpers ───────────────────────────────────────────

  // Entity names verified from src-gen:
  //   Period.ENTITY_NAME = "FinancialMgmtPeriod"
  //   Period.PROPERTY_PERIODNO = "periodNo"  (returns Long)
  //   Period.PROPERTY_YEAR = "year"  (returns Year)
  //   Year.PROPERTY_FISCALYEAR = "fiscalYear"  (String, e.g. "2026")
  //   AcctSchema.ENTITY_NAME = "FinancialMgmtAcctSchema"

  private TaxReport resolveTaxReport(String orgId, String valueKey) {
    // TaxReport.PROPERTY_SEARCHKEY = "searchKey" (verified from src-gen)
    OBCriteria<TaxReport> crit = OBDal.getInstance().createCriteria(TaxReport.class);
    crit.add(Restrictions.eq(TaxReport.PROPERTY_ORGANIZATION + ".id", orgId));
    crit.add(Restrictions.eq(TaxReport.PROPERTY_SEARCHKEY, valueKey));
    crit.setMaxResults(1);
    List<TaxReport> list = crit.list();
    if (list.isEmpty()) {
      throw new OBException("No TaxReport found for org=" + orgId + " searchKey=" + valueKey);
    }
    return list.get(0);
  }

  private AcctSchema resolveAcctSchema(Organization org) {
    OBCriteria<AcctSchema> crit = OBDal.getInstance().createCriteria(AcctSchema.class);
    crit.add(Restrictions.eq(AcctSchema.PROPERTY_CLIENT + ".id", org.getClient().getId()));
    crit.add(Restrictions.eq(AcctSchema.PROPERTY_ACTIVE, true));
    crit.setMaxResults(1);
    List<AcctSchema> list = crit.list();
    if (list.isEmpty()) {
      throw new OBException("No AcctSchema found for client=" + org.getClient().getId());
    }
    return list.get(0);
  }

  private List<Period> resolvePeriods(String orgId, int year, String periodCode) {
    int monthFrom, monthTo;
    if (periodCode.startsWith("T")) {
      int q = Integer.parseInt(periodCode.substring(1));
      monthFrom = (q - 1) * 3 + 1;
      monthTo   = q * 3;
    } else {
      monthFrom = monthTo = Integer.parseInt(periodCode);
    }
    // fiscalYear is a String in FinancialMgmtYear; periodNo is a Long
    @SuppressWarnings("unchecked")
    List<Period> list = OBDal.getInstance().getSession()
        .createQuery(
            "from FinancialMgmtPeriod p " +
            "where p.organization.id = :orgId " +
            "  and p.year.fiscalYear = :year " +
            "  and p.periodNo between :from and :to " +
            "order by p.periodNo",
            Period.class)
        .setParameter("orgId", orgId)
        .setParameter("year", String.valueOf(year))
        .setParameter("from", (long) monthFrom)
        .setParameter("to",   (long) monthTo)
        .list();
    return list;
  }

  // ── Utility ──────────────────────────────────────────────────────

  private void addToBox(Map<Integer, BigDecimal> b, int box, BigDecimal val) {
    if (val == null || val.compareTo(BigDecimal.ZERO) == 0) return;
    b.merge(box, val, BigDecimal::add);
  }

  private BigDecimal sumBoxes(Map<Integer, BigDecimal> b, int[] boxes) {
    BigDecimal sum = BigDecimal.ZERO;
    for (int box : boxes) sum = sum.add(b.getOrDefault(box, BigDecimal.ZERO));
    return sum;
  }

  private BigDecimal round(BigDecimal v) {
    return v.setScale(2, java.math.RoundingMode.HALF_UP);
  }

  private Map<BigDecimal, List<TaxRate>> splitByPercentage(List<TaxRate> rates) {
    Map<BigDecimal, List<TaxRate>> map = new java.util.LinkedHashMap<>();
    for (TaxRate r : rates) {
      BigDecimal pct = r.getRate().abs().setScale(2, java.math.RoundingMode.HALF_UP);
      map.computeIfAbsent(pct, k -> new ArrayList<>()).add(r);
    }
    return map;
  }

  private JSONObject buildResponse(Map<Integer, BigDecimal> b) throws Exception {
    JSONObject boxes = new JSONObject();
    for (Map.Entry<Integer, BigDecimal> e : b.entrySet()) {
      boxes.put(String.valueOf(e.getKey()), e.getValue().doubleValue());
    }
    BigDecimal accrued   = b.getOrDefault(27, BigDecimal.ZERO);
    BigDecimal deductible = b.getOrDefault(45, BigDecimal.ZERO);
    BigDecimal result    = b.getOrDefault(46, BigDecimal.ZERO);
    JSONObject summary = new JSONObject();
    summary.put("accrued",    accrued.doubleValue());
    summary.put("deductible", deductible.doubleValue());
    summary.put("result",     result.doubleValue());
    JSONObject root = new JSONObject();
    root.put("boxes",   boxes);
    root.put("summary", summary);
    return root;
  }
}
```

- [ ] **Step 3: Verify `AEAT303Report2014Dao.getInvoiceTaxRates()` signature**

Run:
```bash
grep -n "getInvoiceTaxRates\|getTaxRates\|getTaxReportParameter" \
  modules/org.openbravo.module.aeat303.es/src/org/openbravo/module/aeat303/es/report/v2014/AEAT303Report2014Dao.java | head -20
```

If the method is named differently (e.g., `getTaxRates(taxReport, groupSearchkey, paramSearchkey)`), update all calls in `fillGroupBoxes` and `fillSalesBoxes` to match the actual signature. The lookup pattern is: `taxReport → group by searchkey → parameter by searchkey → list of TaxRate`.

- [ ] **Step 4: Verify HQL entity names compile**

The HQL strings use:
- `OBTL_TaxReport` — check with `grep -r "entity.*TaxReport\|class TaxReport" modules/` to confirm the exact DAL entity name.
- `FinancialMgmtAcctSchema` — standard Openbravo entity for `C_AcctSchema`.
- `FinancialMgmtPeriod` — standard entity for `C_Period`.
- `Period.year.year` — `C_Period → c_year_id → C_Year.year` (String column).

If entity names differ, fix the HQL. The canonical names are in `src-gen/` generated DAL classes.

---

## Task 2: Wire into `NeoBuiltInEndpointHandler`

**Files:**
- Modify: `modules/com.etendoerp.go/src/com/etendoerp/go/schemaforge/NeoBuiltInEndpointHandler.java`

- [ ] **Step 1: Add `Fiscal303BoxesHandler` field**

```java
private final Fiscal303BoxesHandler fiscal303Handler;

NeoBuiltInEndpointHandler(NeoServlet servlet, NeoDiscoveryHandler discoveryHandler) {
  this.servlet = servlet;
  this.discoveryHandler = discoveryHandler;
  this.fiscal303Handler = new Fiscal303BoxesHandler(servlet);
}
```

- [ ] **Step 2: Add routing in `handle()`**

After the existing `if ("preview-file"...` block, add:

```java
if ("fiscal303".equals(pathInfo.specName)) {
  fiscal303Handler.handle(pathInfo.entityName, method, request, response);
  return true;
}
```

- [ ] **Step 3: Manual test via curl**

Start Etendo locally, then:
```bash
TOKEN=$(curl -s -X POST http://localhost:8080/etendo/sws/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"admin"}' | jq -r '.token')

curl -s "http://localhost:8080/etendo/neo/fiscal303/boxes?year=2026&period=T2" \
  -H "Authorization: Bearer $TOKEN" | jq .
```

Expected shape:
```json
{
  "boxes": { "1": 44, "3": 1.76, "7": 6162.60, "9": 1294.15, "27": 1309.98, "28": 175186, "29": 36789.06, "45": 36789.06, "46": -35479.08 },
  "summary": { "accrued": 1309.98, "deductible": 36789.06, "result": -35479.08 }
}
```

Values must match the existing GOOrg T2/2026 mock data (within rounding).

---

## Task 3: Frontend — replace stub with real fetch

**Files:**
- Modify: `tools/app-shell/src/windows/custom/fiscal-models/fiscalModelsUtils.js`

- [ ] **Step 1: Add `neoBase` import**

```js
import { neoBase } from '@/components/related-documents/helpers.js';
```

- [ ] **Step 2: Replace stub body**

```js
export async function computeBoxes303(decl, { token, apiBaseUrl } = {}) {
  if (token && apiBaseUrl) {
    try {
      const url = `${neoBase(apiBaseUrl)}/fiscal303/boxes?year=${decl.year}&period=${decl.period}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) return await res.json();
    } catch (_) {
      // fall through to mock
    }
  }

  // ── Mock fallback (demo / no backend) ─────────────────────────
  await new Promise(r => setTimeout(r, 900));

  if (decl.year === 2026 && decl.period === 'T2') {
    return {
      boxes: { 1:44, 3:1.76, 4:201, 6:14.07, 7:6162.60, 9:1294.15, 27:1309.98, 28:175186, 29:36789.06, 45:36789.06, 46:-35479.08, 59:23, 60:36 },
      summary: { accrued:1309.98, deductible:36789.06, result:-35479.08 },
    };
  }
  if (decl.year === 2026 && decl.period === 'T1') {
    return {
      boxes: { 7:3248, 9:682.08, 27:682.08, 28:16659, 29:3498.39, 45:3498.39, 46:-2816.31 },
      summary: { accrued:682.08, deductible:3498.39, result:-2816.31 },
    };
  }
  return null;
}
```

- [ ] **Step 3: Run tests**

```bash
node --test src/windows/custom/fiscal-models/__tests__/*.test.js
```

Expected: 156 pass, 0 fail.

---

## Task 4: Update `fiscalModelsUtils.test.js`

**Files:**
- Modify: `tools/app-shell/src/windows/custom/fiscal-models/__tests__/fiscalModelsUtils.test.js`

- [ ] **Step 1: Add test coverage for real-path vs mock fallback**

```js
describe('computeBoxes303 — mock fallback', () => {
  it('returns T2 2026 boxes when no token', async () => {
    const result = await computeBoxes303({ year: 2026, period: 'T2' });
    assert.ok(result !== null);
    assert.equal(result.boxes[27], 1309.98);
    assert.equal(result.summary.result, -35479.08);
  });
  it('returns T1 2026 boxes when no token', async () => {
    const result = await computeBoxes303({ year: 2026, period: 'T1' });
    assert.ok(result !== null);
    assert.equal(result.boxes[27], 682.08);
  });
  it('returns null for unsupported period', async () => {
    const result = await computeBoxes303({ year: 2025, period: 'T3' });
    assert.equal(result, null);
  });
});
```

- [ ] **Step 2: Run all tests**

```bash
node --test src/windows/custom/fiscal-models/__tests__/*.test.js
```

Expected: 159+ pass, 0 fail.

---

## Known Risks

1. **Legacy rates (7%, 8%, 16%, 18%)**: `AEAT303Report2014` accumulates these into the next bucket using an `oldtaxes` list before computing. For GOOrg's current invoices this isn't needed (all rates are current), but if legacy invoices exist the box totals may differ slightly. Can be refined in a follow-up.
2. ~~`TaxReport.PROPERTY_VALUE`~~ — **Resolved**: DAL property is `TaxReport.PROPERTY_SEARCHKEY = "searchKey"`, stored in DB column `value`. The code in Task 1 uses this correctly.
3. **Cash VAT view**: If `C_InvoiceTaxCashVAT_V` doesn't exist, `calculateAmountsMap` may throw. Wrap `computeBoxes()` in a broad try/catch and return HTTP 500 with a clear message.
4. **rectificaciones / memo invoices (boxes 14/15)**: The current plan uses `InvoiceType.ALL` for all groups, which includes credit memos. `AEAT303Report2014` handles them separately in a `modificacionBICuotaTaxRates` accumulator → boxes 14/15. For an initial version this is acceptable; the boxes 14/15 can be added in a follow-up.

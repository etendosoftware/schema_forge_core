# Migration Notes: C_OrderJR

**Source:** `C_OrderJR.jrxml`
**Orientation:** portrait (595x842)
**Query Language:** SQL

## Fields

| Field | Java Type | Mapped Type |
|-------|-----------|-------------|
| C_ORDER_ID | java.lang.String | string |
| NAME | java.lang.String | string |
| ADDRESS1 | java.lang.String | string |
| PHONE | java.lang.String | string |
| FAX | java.lang.String | string |
| URL | java.lang.String | string |
| DESCRIPTION | java.lang.String | string |
| DATEORDERED | java.util.Date | date |
| ALBARAN | java.lang.String | string |
| COMPLETE_NAME | java.lang.String | string |
| ENTITY | java.lang.String | string |
| LOCATION | java.lang.String | string |
| ORGANIZATIONID | java.lang.String | string |
| STATUS | java.lang.String | string |
| BP_DATA | java.lang.String | string |
| ORG_TAXID | java.lang.String | string |
| SHOWLOGO | java.lang.String | string |
| SHOWCOMPANYDATA | java.lang.String | string |
| HEADERMARGIN | java.lang.String | string |
| ORG_NAME | java.lang.String | string |
| DELIVERYTERM | java.lang.String | string |
| PAYMENTTERM | java.lang.String | string |
| DOC_TYPE | java.lang.String | string |
| CURRENCY_ISO | java.lang.String | string |
| ISTAXINCLUDED | java.lang.String | string |

## Parameters

| Parameter | Type | Prompted |
|-----------|------|----------|
| ATTACH | java.lang.String | false |
| BASE_WEB | java.lang.String | false |
| BASE_DESIGN | java.lang.String | false |
| LANGUAGE | java.lang.String | false |
| USER_CLIENT | java.lang.String | false |
| USER_ORG | java.lang.String | false |
| REPORT_TITLE | java.lang.String | false |
| REPORT_SUBTITLE | java.lang.String | false |
| SUBREPORT_DIR | java.lang.String | false |
| DOCUMENT_ID | java.lang.String | false |
| LOCALE | java.util.Locale | false |
| NUMBERFORMAT | java.text.DecimalFormat | false |
| SUBREP_C_OrderLinesJR | net.sf.jasperreports.engine.JasperReport | false |
| SUBREP_C_OrderLinesTaxIncludedJR | net.sf.jasperreports.engine.JasperReport | false |
| SUBREP_RptC_Order_TaxLines | net.sf.jasperreports.engine.JasperReport | false |

## Groups (Hierarchy)

1. **PrintLarge** → `` (labels: )
2. **PrintMedium** → `` (labels: )
3. **PrintSmall** → `` (labels: )
4. **C_ORDER_ID** → `C_ORDER_ID` (labels: Order Number, Date, Currency, PURCHASE ORDER, SALES ORDER)

## Detail Columns

- **Order Number** → `C_ORDER_ID` (string)
- **Date** → `NAME` (string)
- **Currency** → `ADDRESS1` (string)
- **PURCHASE ORDER** → `PHONE` (string)
- **SALES ORDER** → `FAX` (string)
- **U R L** → `URL` (string)
- **D E S C R I P T I O N** → `DESCRIPTION` (string)
- **D A T E O R D E R E D** → `DATEORDERED` (date)
- **A L B A R A N** → `ALBARAN` (string)
- **C O M P L E T E  N A M E** → `COMPLETE_NAME` (string)
- **E N T I T Y** → `ENTITY` (string)
- **L O C A T I O N** → `LOCATION` (string)
- **O R G A N I Z A T I O N I D** → `ORGANIZATIONID` (string)
- **S T A T U S** → `STATUS` (string)
- **B P  D A T A** → `BP_DATA` (string)
- **O R G  T A X I D** → `ORG_TAXID` (string)
- **S H O W L O G O** → `SHOWLOGO` (string)
- **S H O W C O M P A N Y D A T A** → `SHOWCOMPANYDATA` (string)
- **H E A D E R M A R G I N** → `HEADERMARGIN` (string)
- **O R G  N A M E** → `ORG_NAME` (string)
- **D E L I V E R Y T E R M** → `DELIVERYTERM` (string)
- **P A Y M E N T T E R M** → `PAYMENTTERM` (string)
- **D O C  T Y P E** → `DOC_TYPE` (string)
- **C U R R E N C Y  I S O** → `CURRENCY_ISO` (string)
- **I S T A X I N C L U D E D** → `ISTAXINCLUDED` (string)

## SQL Query

```sql
SELECT C_ORDER.C_ORDER_ID, C_BPARTNER.NAME, L.ADDRESS1 ||
(CASE WHEN (L.POSTAL||L.CITY||R.NAME) IS NOT NULL THEN (CHR(10)||L.POSTAL || (CASE WHEN L.POSTAL IS NOT NULL THEN (' - '||TO_CHAR(L.CITY)) END) ||
(CASE WHEN R.NAME IS NOT NULL THEN (' ('||TO_CHAR(R.NAME)|| ')') END)) END) AS ADDRESS1,
C_BPARTNER_LOCATION.PHONE,C_BPARTNER_LOCATION.FAX,C_BPARTNER.URL,
C_ORDER.DESCRIPTION, C_ORDER.DATEORDERED, C_ORDER.DOCUMENTNO AS ALBARAN,
C_BPARTNER.NAME2 || ' (' || C_BPARTNER.NAME || ')' AS COMPLETE_NAME, AD_CLIENT.DESCRIPTION AS ENTITY,
C_LOCATION_DESCRIPTION(AD_ORGINFO.C_LOCATION_ID) AS LOCATION,  AD_ORG.ad_org_id AS ORGANIZATIONID, C_ORDER.docstatus AS STATUS,
(COALESCE(TO_CHAR(AD_USER.NAME), '') || CASE WHEN AD_USER.NAME IS null THEN '' ELSE CHR(13) END || COALESCE(TO_CHAR(C_BPARTNER.TAXID), '') || CASE WHEN C_BPARTNER.TAXID IS null THEN '' ELSE CHR(13) END ||
COALESCE(TO_CHAR(ADDRESS1), '') || CASE WHEN ADDRESS1 IS null THEN '' ELSE CHR(13) END || COALESCE(TO_CHAR(POSTAL), '') || CASE WHEN POSTAL IS null THEN '' ELSE CHR(13) END ||
COALESCE(TO_CHAR(L.CITY), '') || CASE WHEN L.CITY IS null THEN '' ELSE CHR(13) END || COALESCE(TO_CHAR(CO.NAME), '') || CASE WHEN CO.NAME IS null THEN '' ELSE CHR(13) END ||
COALESCE(TO_CHAR(C_BPARTNER_LOCATION.PHONE), '') || CASE WHEN C_BPARTNER_LOCATION.PHONE IS null THEN '' ELSE CHR(13) END || COALESCE(TO_CHAR(C_BPARTNER_LOCATION.FAX), '') ||
CASE WHEN C_BPARTNER_LOCATION.FAX IS null THEN '' ELSE CHR(13) END) AS BP_DATA, AD_ORGINFO.TAXID AS ORG_TAXID, SHOWLOGO, SHOWCOMPANYDATA, HEADERMARGIN,
AD_ORG.NAME AS ORG_NAME, DELIVERYRULE.NAME AS DELIVERYTERM, PAYMENTTERM.TERM AS PAYMENTTERM, C_POC_DOCTYPE_TEMPLATE.NAME AS DOC_TYPE, C_CURRENCY.ISO_CODE as CURRENCY_ISO, M_PRICELIST.ISTAXINCLUDED
FROM C_BPARTNER_LOCATION left join C_LOCATION L on C_BPARTNER_LOCATION.C_LOCATION_ID = L.C_LOCATION_ID
             left join C_COUNTRY CO ON L.C_COUNTRY_ID = CO.C_COUNTRY_ID
             left join  C_REGION R on L.C_REGION_ID = R.C_REGION_ID,
     AD_USER right join C_ORDER on AD_USER.AD_USER_ID = C_ORDER.AD_USER_ID
                         left join C_POC_DOCTYPE_TEMPLATE ON C_POC_DOCTYPE_TEMPLATE.C_DOCTYPE_ID = C_ORDER.C_DOCTYPETARGET_ID,
C_BPARTNER, AD_ORGINFO, AD_CLIENT, AD_ORG,
   (SELECT VALUE, NAME
    FROM AD_REF_LIST_V
    WHERE AD_REFERENCE_ID = '151'
          AND AD_LANGUAGE IN ($P{LANGUAGE})) DELIVERYRULE,
   (SELECT C_PAYMENTTERM.C_PAYMENTTERM_ID, COALESCE( C_PAYMENTTERM_TRL.NAME, C_PAYMENTTERM.NAME) AS TERM
    FROM C_PAYMENTTERM LEFT JOIN C_PAYMENTTERM_TRL ON C_PAYMENTTERM.C_PAYMENTTERM_ID = C_PAYMENTTERM_TRL.C_PAYMENTTERM_ID
          AND C_PAYMENTTERM_TRL.AD_LANGUAGE IN ($P{LANGUAGE})) PAYMENTTERM, C_CURRENCY, M_PRICELIST
WHERE C_ORDER.C_BPARTNER_LOCATION_ID = C_BPARTNER_LOCATION.C_BPARTNER_LOCATION_ID
AND C_ORDER.M_PRICELIST_ID = M_PRICELIST.M_PRICELIST_ID
AND C_ORDER.C_BPARTNER_ID = C_BPARTNER.C_BPARTNER_ID
AND AD_ORG.ad_org_id = AD_ORGINFO.ad_org_id
AND AD_ORG.ad_org_id = (SELECT o.AD_ORG_ID FROM AD_ORG o JOIN AD_OrgType t USING (AD_ORGTYPE_ID)
WHERE AD_ISORGINCLUDED(C_ORDER.AD_ORG_ID, o.ad_org_id, C_ORDER.ad_client_id)<>-1
AND (t.IsLegalEntity='Y' OR t.IsAcctLegalEntity='Y'))
AND C_ORDER.AD_CLIENT_ID = AD_CLIENT.AD_CLIENT_ID
AND C_ORDER.C_ORDER_ID IN ($P{DOCUMENT_ID})
AND C_ORDER.DELIVERYRULE = DELIVERYRULE.VALUE
AND C_ORDER.C_PAYMENTTERM_ID = PAYMENTTERM.C_PAYMENTTERM_ID
AND C_CURRENCY.C_CURRENCY_ID=C_ORDER.C_CURRENCY_ID
```

## Migration TODO

- [ ] Create NEO Headless endpoint or custom data source for this report
- [ ] Map SQL query columns to NEO API response fields
- [ ] Generate Handlebars template with group headers
- [ ] Test with real data via jsreport
- [ ] Add to menu / window print button

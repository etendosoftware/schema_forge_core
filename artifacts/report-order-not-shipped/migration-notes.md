# Migration Notes: ReportOrderNotShipped

**Source:** `ReportOrderNotShipped.jrxml`
**Orientation:** landscape (842x595)
**Query Language:** SQL

## Fields

| Field | Java Type | Mapped Type |
|-------|-----------|-------------|
| orgname | java.lang.String | string |
| bpname | java.lang.String | string |
| documentno | java.lang.String | string |
| poreference | java.lang.String | string |
| dateordered | java.util.Date | date |
| datepromised | java.util.Date | date |
| deliveryrule | java.lang.String | string |
| deliverylocation | java.lang.String | string |
| prodname | java.lang.String | string |
| m_attributesetinstance_id | java.lang.String | string |
| orderedqty | java.lang.String | string |
| pendingqty | java.lang.String | string |
| qtyinstock | java.lang.String | string |
| aumsymbol | java.lang.String | string |

## Parameters

| Parameter | Type | Prompted |
|-----------|------|----------|
| REPORT_TITLE | java.lang.String | false |
| REPORT_SUBTITLE | java.lang.String | false |
| NUMBERFORMAT | java.text.DecimalFormat | false |
| showInAUM | java.lang.Boolean | false |

## Groups (Hierarchy)

1. **orgname** → `orgname` (labels: Organization)
2. **bpname** → `bpname` (labels: Business Partner)
3. **documentno** → `documentno` (labels: Order Document No., Order Date, Delivery Date, Delivery Terms, Delivery Location, Product, Ordered Quantity, Pending Quantity, Quantity in Stock, Unit, Quantity in Stock)

## Detail Columns

- **Product** → `prodname` (string)
- **Ordered Quantity** → `orderedqty` (string)
- **Pending Quantity** → `pendingqty` (string)
- **Quantity in Stock** → `qtyinstock` (string)
- **Unit** → `aumsymbol` (string)
- **Quantity in Stock** → `qtyinstock` (string)

## SQL Query

```sql
SELECT ORG.NAME AS ORGNAME, BP.NAME AS BPNAME,
O.DOCUMENTNO, O.POREFERENCE, TO_DATE(O.DATEORDERED) AS DATEORDERED, TO_DATE(O.DATEPROMISED) AS DATEPROMISED,
REFLISTV.NAME AS DELIVERYRULE, COALESCE(DLOC.NAME, BPADD.NAME) AS DELIVERYLOCATION,
PR.NAME || ' ' || COALESCE(TO_CHAR(ASI.DESCRIPTION), '') AS PRODNAME, OL.M_ATTRIBUTESETINSTANCE_ID,
OL.QTYORDERED || ' ' || COALESCE(TO_CHAR(UO.UOMSYMBOL), '') AS ORDEREDQTY,
(OL.QTYORDERED-OL.QTYDELIVERED) || ' ' || COALESCE(TO_CHAR(UO.UOMSYMBOL), '') AS PENDINGQTY,
SUM(SD.QTYONHAND) || ' ' || COALESCE(TO_CHAR(UO.UOMSYMBOL), '') AS QTYINSTOCK
FROM AD_ORG ORG, C_BPARTNER BP, C_BPARTNER_LOCATION BPADD,
M_PRODUCT PR, C_UOM UO,
C_ORDER O
LEFT JOIN AD_REF_LIST_V REFLISTV
ON REFLISTV.VALUE = O.DELIVERYRULE
LEFT JOIN C_BPARTNER_LOCATION DLOC
ON DLOC.C_BPARTNER_LOCATION_ID = O.DELIVERY_LOCATION_ID,
C_ORDERLINE OL
LEFT JOIN M_ATTRIBUTESETINSTANCE ASI
ON OL.M_ATTRIBUTESETINSTANCE_ID = ASI.M_ATTRIBUTESETINSTANCE_ID
LEFT JOIN M_STORAGE_DETAIL SD
ON OL.M_PRODUCT_ID = SD.M_PRODUCT_ID
AND OL.C_UOM_ID = SD.C_UOM_ID
AND COALESCE(OL.M_ATTRIBUTESETINSTANCE_ID,'0') = COALESCE(SD.M_ATTRIBUTESETINSTANCE_ID,'0')
AND COALESCE(OL.M_PRODUCT_UOM_ID, '-1') = COALESCE(SD.M_PRODUCT_UOM_ID,'-1')
AND SD.M_LOCATOR_ID IN (SELECT LOC.M_LOCATOR_ID
FROM M_LOCATOR LOC
WHERE LOC.M_WAREHOUSE_ID = OL.M_WAREHOUSE_ID)
WHERE O.AD_ORG_ID = ORG.AD_ORG_ID
AND O.C_BPARTNER_ID = BP.C_BPARTNER_ID
AND O.C_BPARTNER_LOCATION_ID = BPADD.C_BPARTNER_LOCATION_ID
AND O.C_ORDER_ID = OL.C_ORDER_ID
AND O.DOCSTATUS IN ('CO','CL')
AND O.ISSOTRX = 'Y'
AND O.AD_CLIENT_ID IN ('1000000')
AND O.AD_ORG_ID IN ('1000000')
AND OL.M_PRODUCT_ID = PR.M_PRODUCT_ID
AND OL.C_UOM_ID = UO.C_UOM_ID
AND EXISTS (SELECT 1
FROM C_ORDER ORD, C_ORDERLINE ORDL
WHERE ORD.C_ORDER_ID = O.C_ORDER_ID
AND ORD.C_ORDER_ID = ORDL.C_ORDER_ID
AND ORDL.QTYORDERED <> ORDL.QTYDELIVERED)
AND REFLISTV.AD_REFERENCE_ID = '151'
AND REFLISTV.AD_LANGUAGE = 'en_US'
GROUP BY ORG.NAME, BP.NAME, O.DOCUMENTNO, O.POREFERENCE, O.DATEORDERED, O.DATEPROMISED,
REFLISTV.NAME, DLOC.NAME, BPADD.NAME, PR.NAME, ASI.DESCRIPTION, OL.M_ATTRIBUTESETINSTANCE_ID,
OL.QTYORDERED, UO.UOMSYMBOL, OL.QTYDELIVERED
ORDER BY ORGNAME, BPNAME, DOCUMENTNO
```

## Migration TODO

- [ ] Create NEO Headless endpoint or custom data source for this report
- [ ] Map SQL query columns to NEO API response fields
- [ ] Generate Handlebars template with group headers
- [ ] Test with real data via jsreport
- [ ] Add to menu / window print button

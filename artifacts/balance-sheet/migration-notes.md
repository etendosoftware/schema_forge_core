# Migration Notes: GeneralAccountingReportsPDF

**Source:** `GeneralAccountingReportsPDF.jrxml`
**Orientation:** portrait (595x842)
**Query Language:** SQL

## Fields

| Field | Java Type | Mapped Type |
|-------|-----------|-------------|
| name | java.lang.String | string |
| qty | java.math.BigDecimal | amount |
| qtyRef | java.math.BigDecimal | amount |
| elementLevel | java.lang.Integer | number |
| groupname | java.lang.String | string |
| pagebreak | java.lang.String | string |

## Parameters

| Parameter | Type | Prompted |
|-----------|------|----------|
| REPORT_SUBTITLE | java.lang.String | false |
| TOTAL | java.lang.String | false |
| NUMBERFORMAT | java.text.DecimalFormat | false |
| companyName | java.lang.String | true |
| agno | java.lang.String | true |
| agno2 | java.lang.String | true |
| column | java.lang.String | true |
| columnRef | java.lang.String | true |
| org | java.lang.String | true |
| column1 | java.lang.String | true |
| columnRef1 | java.lang.String | true |
| date | java.lang.String | true |
| startingDate | java.lang.String | true |
| endingDate | java.lang.String | true |
| period | java.lang.String | true |
| periodRef | java.lang.String | true |
| agnoInitial | java.lang.String | true |
| agnoRef | java.lang.String | true |
| principalTitle | java.lang.String | true |
| pageNo | java.lang.String | true |
| compareTo | java.lang.String | true |

## Groups (Hierarchy)

1. **group** → `groupname` (labels: )

## Detail Columns

- **Name** → `name` (string)
- **Qty** → `qty` (amount)
- **Qty Ref** → `qtyRef` (amount)
- **Element Level** → `elementLevel` (number)
- **Groupname** → `groupname` (string)
- **Pagebreak** → `pagebreak` (string)

## SQL Query

```sql

```

## Migration TODO

- [ ] Create NEO Headless endpoint or custom data source for this report
- [ ] Map SQL query columns to NEO API response fields
- [ ] Generate Handlebars template with group headers
- [ ] Test with real data via jsreport
- [ ] Add to menu / window print button

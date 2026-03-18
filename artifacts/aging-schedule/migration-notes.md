# Migration Notes: ReportAgingBalance

**Source:** `ReportAgingBalance.jrxml`
**Orientation:** portrait (670x842)
**Query Language:** SQL

## Fields

| Field | Java Type | Mapped Type |
|-------|-----------|-------------|
| BPartner | java.lang.String | string |
| amount0 | java.math.BigDecimal | amount |
| amount1 | java.math.BigDecimal | amount |
| amount2 | java.math.BigDecimal | amount |
| amount3 | java.math.BigDecimal | amount |
| amount4 | java.math.BigDecimal | amount |
| amount5 | java.math.BigDecimal | amount |
| Total | java.math.BigDecimal | amount |
| BPartnerID | java.lang.String | string |
| credit | java.math.BigDecimal | amount |
| net | java.math.BigDecimal | amount |

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
| AMOUNTFORMAT | java.text.DecimalFormat | false |
| LOCALE | java.util.Locale | false |
| InitialBalance | java.math.BigDecimal | false |
| SUBREPORT_DIR | java.lang.String | true |
| DATE_FROM | java.lang.String | false |
| col1 | java.lang.String | false |
| col2 | java.lang.String | false |
| col3 | java.lang.String | false |
| col4 | java.lang.String | false |
| col5 | java.lang.String | false |
| BPartners | java.lang.String | false |
| Date1 | java.lang.String | false |
| Date2 | java.lang.String | false |
| Date3 | java.lang.String | false |
| Date4 | java.lang.String | false |
| Date5 | java.lang.String | false |
| Organization | java.lang.String | false |
| AccSchema | java.lang.String | false |
| Currency | java.lang.String | false |
| toCurrency | java.lang.String | false |
| PayStatus | java.lang.String | false |
| currentDate | java.lang.String | true |
| tabTitle | java.lang.String | true |
| title | java.lang.String | true |
| AccSchemaName | java.lang.String | true |
| OrganizationName | java.lang.String | true |

## Groups (Hierarchy)

1. **Totals** → `` (labels: )

## Detail Columns

- **B Partner** → `BPartner` (string)
- **Amount0** → `amount0` (amount)
- **Amount1** → `amount1` (amount)
- **Amount2** → `amount2` (amount)
- **Amount3** → `amount3` (amount)
- **Amount4** → `amount4` (amount)
- **Amount5** → `amount5` (amount)
- **Total** → `Total` (amount)
- **B Partner I D** → `BPartnerID` (string)
- **Credit** → `credit` (amount)
- **Net** → `net` (amount)

## SQL Query

```sql

```

## Migration TODO

- [ ] Create NEO Headless endpoint or custom data source for this report
- [ ] Map SQL query columns to NEO API response fields
- [ ] Generate Handlebars template with group headers
- [ ] Test with real data via jsreport
- [ ] Add to menu / window print button

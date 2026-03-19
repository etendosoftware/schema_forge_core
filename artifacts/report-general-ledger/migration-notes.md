# Migration Notes: ReportGeneralLedger

**Source:** `ReportGeneralLedger.jrxml`
**Orientation:** portrait (595x842)
**Query Language:** SQL

## Fields

| Field | Java Type | Mapped Type |
|-------|-----------|-------------|
| VALUE | java.lang.String | string |
| NAME | java.lang.String | string |
| DATEACCT | java.util.Date | date |
| AMTACCTDR | java.math.BigDecimal | amount |
| AMTACCTCR | java.math.BigDecimal | amount |
| TOTAL | java.math.BigDecimal | amount |
| FACT_ACCT_GROUP_ID | java.lang.String | string |
| ID | java.lang.String | string |
| GROUPBYID | java.lang.String | string |
| GROUPBYNAME | java.lang.String | string |
| DESCRIPTION | java.lang.String | string |
| TOTALACCTDR | java.math.BigDecimal | amount |
| TOTALACCTCR | java.math.BigDecimal | amount |
| TOTALACCTSUB | java.math.BigDecimal | amount |
| PREVIOUSDEBIT | java.math.BigDecimal | amount |
| PREVIOUSCREDIT | java.math.BigDecimal | amount |
| PREVIOUSTOTAL | java.math.BigDecimal | amount |
| FINALDEBIT | java.math.BigDecimal | amount |
| FINALCREDIT | java.math.BigDecimal | amount |
| FINALTOTAL | java.math.BigDecimal | amount |
| DATEACCTNUMBER | java.lang.String | string |
| GROUPBY | java.lang.String | string |

## Parameters

| Parameter | Type | Prompted |
|-----------|------|----------|
| ATTACH | java.lang.String | false |
| BASE_WEB | java.lang.String | false |
| BASE_DESIGN | java.lang.String | false |
| LANGUAGE | java.lang.String | false |
| USER_CLIENT | java.lang.String | false |
| USER_ORG | java.lang.String | false |
| REPORT_SUBTITLE | java.lang.String | false |
| ShowGrouping | java.lang.Boolean | false |
| NUMBERFORMAT | java.text.DecimalFormat | false |
| LOCALE | java.util.Locale | false |
| strDateFormat | java.lang.String | false |
| Previous | java.lang.String | false |
| Total | java.lang.String | false |
| GroupByText | java.lang.String | false |
| PageNo | java.lang.String | false |

## Groups (Hierarchy)

1. **Grouping** → `GROUPBYID` (labels: )
2. **AccountGroup** → `VALUE` (labels: Acct. No., Date, Debit, Credit, Balance, Description)

## Detail Columns

- **Date** → `DESCRIPTION` (string)
- **Debit** → `AMTACCTDR` (amount)
- **Credit** → `AMTACCTCR` (amount)
- **Balance** → `TOTALACCTSUB` (amount)
- **Description** → `DATEACCT` (date)

## SQL Query

```sql
SELECT value, name, dateacct,
              SUM(AMTACCTDR) AS amtacctdr, SUM(AMTACCTCR) AS amtacctcr, (SUM(AMTACCTDR)-SUM(AMTACCTCR)) AS total,
              FACT_ACCT_GROUP_ID, id, groupbyid, groupbyname,
              MIN(DESCRIPTION) AS description,
              0 AS totalacctdr, 0 AS totalacctcr, 0 AS totalacctsub,
              0 AS previousdebit, 0 AS previouscredit, 0 AS previoustotal,
              0 AS finaldebit, 0 AS finalcredit, 0 AS finaltotal,
              TO_CHAR(DATEACCT,'J') AS dateacctnumber,
              'aaa' AS groupby
          FROM
            (SELECT FACT_ACCT.ACCTVALUE AS VALUE, FACT_ACCT.ACCTDESCRIPTION AS NAME,
                DATEACCT, AMTACCTDR, AMTACCTCR,
                FACT_ACCT_GROUP_ID, FACT_ACCT.ACCOUNT_ID AS ID, FACT_ACCT.DESCRIPTION,
                CASE 'BPartner'
                  WHEN 'BPartner' THEN c_bpartner.c_bpartner_id
                  WHEN 'Product' THEN m_product.m_product_id
                  WHEN 'Project' THEN c_project.c_project_id
                  ELSE '' END AS groupbyid,
                CASE 'BPartner'
                  WHEN 'BPartner' THEN to_char(c_bpartner.name)
                  WHEN 'Product' THEN to_char(m_product.name)
                  WHEN 'Project' THEN to_char(c_project.name)
                  ELSE '' END AS groupbyname,
                CASE WHEN AMTACCTDR <> 0 THEN 'Y' ELSE 'N' END AS ISDEBIT
            FROM FACT_ACCT
              LEFT JOIN C_BPARTNER ON FACT_ACCT.C_BPARTNER_ID = C_BPARTNER.C_BPARTNER_ID
              LEFT JOIN M_PRODUCT ON FACT_ACCT.M_PRODUCT_ID = M_PRODUCT.M_PRODUCT_ID
              LEFT JOIN C_PROJECT ON FACT_ACCT.C_PROJECT_ID = C_PROJECT.C_PROJECT_ID
              LEFT JOIN(
                  select account_id, record_id2, sum(amtacctdr-amtacctcr) as sum
                  from fact_acct f1
                  where 5=5
                  group by account_id, record_id2
                ) f2 ON fact_acct.account_id = f2.account_id and fact_acct.record_id2 = f2.record_id2
            WHERE  3=3) D
            WHERE 6=6
            GROUP BY groupbyname, groupbyid, VALUE, NAME, ID, DATEACCT, FACT_ACCT_GROUP_ID, ISDEBIT
            HAVING SUM(AMTACCTDR) - SUM(AMTACCTCR) <> 0
            ORDER  BY groupbyname, groupbyid, VALUE, NAME, ID, DATEACCT,  FACT_ACCT_GROUP_ID, ISDEBIT
```

## Migration TODO

- [ ] Create NEO Headless endpoint or custom data source for this report
- [ ] Map SQL query columns to NEO API response fields
- [ ] Generate Handlebars template with group headers
- [ ] Test with real data via jsreport
- [ ] Add to menu / window print button

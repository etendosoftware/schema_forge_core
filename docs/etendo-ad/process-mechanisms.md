# Etendo Process Mechanisms

How processes are linked and executed in Etendo 25/26. There are 3 distinct mechanisms plus rare hardcoded buttons.

## Overview

| Mechanism | Source | Description |
|-----------|--------|-------------|
| `tab_process` | `AD_Tab.AD_Process_ID` → `AD_Process` | Tab-level print/report process |
| `classic_process` | `AD_Column.AD_Process_ID` → `AD_Process` | Button column → classic AD_Process |
| `obuiapp_process` | `AD_Column.EM_OBUIAPP_Process_ID` → `OBUIAPP_Process` | New process definition with ActionHandler class |
| `hardcoded` | Button column (ref=28) with no process linked | Framework convention, very rare |

## 1. Tab Process (`AD_Tab.AD_Process_ID`)

`AD_TAB.AD_PROCESS_ID` is a VARCHAR(32) FK to `AD_PROCESS`. It defines the **default print/report process** for the tab.

When configured (`tab.getProcess() != null`):

- **Print/Email buttons** appear automatically in the tab toolbar (`OBViewTab.java:263`).
- **Report generation**: the system checks if the process is a Jasper Report (`process.isJasperReport()`) or a custom Java process (`process.getJavaClassName()`), and executes accordingly via `DocumentReportingUtils`.
- **Report pool exclusion**: the view `OBUIAPP_POOL_REPORT_V` explicitly excludes processes already assigned to tabs, to avoid duplicates.
- **Frontend**: these processes are sent as `iconToolbarButtons` with `isProcessDefinition` flag. `OBStandardWindow.getProcessOwnerView(processId)` resolves which view/tab owns the process.

Related fields in `AD_Tab`:
- `PROCESSING` (CHAR 1): flag indicating if processing is active
- `EMAIL_PROCESS_ID`: FK to `OBUIAPP_PROCESS` for a tab-specific email process

## 2. Classic Process (`AD_Column.AD_Process_ID`)

Button columns (`AD_Reference_ID=28`) with a direct FK to `AD_Process`. When the user clicks the button:

1. The window servlet dispatches command `BUTTON{ColumnName}{ProcessId}`
2. `ProcessRunner` executes the linked `AD_Process`
3. The process can be a Java class, a Jasper report, or an action button HTML form

Examples: `DocAction` → Process Order (104), `CopyFrom` → Copy Lines (211).

## 3. OBUIAPP Process (`AD_Column.EM_OBUIAPP_Process_ID`)

The modern mechanism. Button columns with FK to `OBUIAPP_Process`, which has:
- `Classname`: Java class extending `BaseProcessActionHandler` or `com.smf.jobs.Action`
- `UIPattern`: defines how the UI renders (standard, manual, A=action)
- `IsMultiRecord`: whether the process supports multi-record selection

Resolution order in `OBViewTab.ButtonField`:
1. Check `column.getOBUIAPPProcess()` (OBUIAPP) — preferred
2. Check `column.getProcess()` (classic AD_Process) — fallback
3. Check column name for hardcoded cases (`Posted`, `CreateFrom`) — legacy

Examples: Cancel and Replace → `CancelAndReplaceSalesOrder.java`, Add Payment → `AddPaymentActionHandler.java`.

## 4. Hardcoded Buttons

Button columns with no process linked at all. The framework resolves them by column name convention. Very rare in modern Etendo. The WAD code generator has explicit checks:

```java
if (fab[i].realname.equalsIgnoreCase("Posted") && fab[i].adProcessId.equals(""))
```

Note: `Posted` has **both** a legacy hardcoded handler AND a modern `obuiapp_process` (`com.smf.jobs.defaults.Post`). The OBUIAPP version is the active one in current Etendo.

## Difference Summary

| Level | Column | Purpose |
|-------|--------|---------|
| Tab (`AD_TAB.AD_PROCESS_ID`) | Process for the entire tab | Print/report generation for the document |
| Column (`AD_COLUMN.AD_PROCESS_ID`) | Process for a Button field | Specific action triggered by clicking the button |
| Column (`AD_COLUMN.EM_OBUIAPP_PROCESS_ID`) | Process definition (new) | ActionHandler-based process, same button trigger |

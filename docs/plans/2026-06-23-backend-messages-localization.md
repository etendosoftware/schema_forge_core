# Spec: Backend messages (AD_Message) in GO language

**Epic:** ETP-3504 (localization)
**Status:** Draft — for path validation before Jira/branch creation
**Sibling task:** ETP-4304 (selector values) — shares the root cause, different surface
**Repos:** `schema-forge` (frontend) + `com.etendoerp.go` (NEO Headless backend) + Etendo core DB procedures
**Date:** 2026-06-23

---

## 1. Problem

Backend messages resolved from `AD_Message` come back in the **Classic** user's
language, not the language configured in GO. When GO is in Spanish but the Etendo
Classic user logs in in English, some messages still appear in English.

These messages reach the user through:
- **Java processes** (validations, process execution results, callouts) that
  resolve message text via `AD_Message`.
- **Database procedures (PL/SQL)** that raise/return a message **code** (the
  `AD_Message.Value` search key, often as `@token@` placeholders). The procedure
  does **not** translate text itself — the **Java layer** translates the returned
  code to text. See §2.

---

## 2. Root cause

Same underlying cause as ETP-4304: the backend resolves the message language from
the **Classic session**, not from the GO locale.

> **Correction (validated with Etendo architecture):** an earlier draft assumed
> PL/SQL translates `AD_Message_Trl` itself using a DB-session/connection language.
> That is **not** the common pattern. PL/SQL procedures **return a message code**
> (`AD_Message.Value`, often as `@token@` placeholders, via
> `RAISE_APPLICATION_ERROR` or an out param). **The translation to text happens in
> Java**, with the language passed **as an explicit argument** —
> `Utility.translateError(conn, vars, language, message)` /
> `Utility.messageBD(conn, key, language)`. That `language` comes from the
> session (`OBContext` / `vars`), which Etendo lets you change **in the session**
> — no JDBC-connection change required.

So **both layers collapse into one Java-side concern**: make message/error
translation use the **GO locale** instead of the Classic session language.

| Layer | How message text is produced | Where the language is applied |
|-------|------------------------------|-------------------------------|
| Java messages | `OBMessageUtils.messageBD()` / `Utility.messageBD()` → `AD_Message` + `AD_Message_Trl` | `OBContext`/`vars` language (Java) |
| DB-procedure messages | PL/SQL returns a **code** (`@key@`); Java translates via `Utility.translateError(...)` | **Java** translation call — `language` argument |

> **Key insight (corrected):** there is no separate DB-session-language problem for
> the standard error-code path. Setting the session/`OBContext` language to the GO
> locale (or passing it explicitly to `translateError`/`messageBD`) fixes the
> PL/SQL-sourced messages too. This also unifies the mechanism with ETP-4304.

### AD_Message translation model
`AD_Message` (base) ↔ `AD_Message_Trl` (`ad_message_id + ad_language`, columns
`msgtext`, `msgtip`). Resolution = `COALESCE(trl.msgtext, base.msgtext)` filtered
by the active language.

---

## 3. Design decisions

Consistent with ETP-4304: **the frontend sends the active GO locale**; the backend
resolves messages in that language on both layers.

### 3.1 Java layer
- Resolve `AD_Message` text using the requested GO language instead of the session
  language. Either:
  - **(a)** `OBContext.setLanguage(requestedLang)` (try/finally restore) around
    message resolution, reusing `OBMessageUtils` as-is; or
  - **(b)** call the explicit-language API `Utility.messageBD(conn, key, requestedLang)`
    where messages are built into NEO responses (`NeoProcessService`, callouts,
    validation errors).
- Preference: align with whatever ETP-4304 lands on (likely `setLanguage`) for
  consistency, but the explicit-language API is cleaner where available.

### 3.2 DB-procedure-sourced messages (same Java-side fix)
PL/SQL returns a **code**, not translated text — so this is fixed in **Java**, the
same way as §3.1. No JDBC-connection / DB-session-language change is needed for the
standard error path.

- Ensure the code→text translation of procedure errors uses the GO language:
  - If using `OBContext.setLanguage(requestedLang)` (try/finally), the standard
    `OBMessageUtils.translateError()` / `Utility.translateError()` will pick it up
    automatically.
  - Or pass the GO language explicitly to `Utility.translateError(conn, vars,
    requestedLang, message)` / `Utility.messageBD(conn, key, requestedLang)` at the
    NEO boundary where SQL exceptions become responses.
- **Investigation (smaller than first thought):** confirm in `com.etendoerp.go`
  where DB-procedure SQLExceptions are caught and turned into NEO responses, and
  which translation call/language they use today.

> **Edge case to check, not assume:** a minority of Etendo PL/SQL reads
> `AD_Message_Trl` *directly* (e.g. `AD_MESSAGE_GET`-style functions that take a
> `language` argument) and returns already-translated text. If any NEO path depends
> on one of those, that specific call must receive the GO language as its `language`
> parameter. This is a per-call fix, still **not** a connection-level concern.

---

## 4. Scope

### In scope
- Frontend: requests that can trigger backend messages carry the active GO locale
  (reuse the same param introduced for ETP-4304 where possible).
- Java: `AD_Message` resolution uses the GO language in NEO message paths
  (process results, callouts, validations).
- DB procedures: propagate the GO language to the DB session so PL/SQL-sourced
  messages resolve in the right language.
- Tests for both layers.

### Out of scope
- Selector values → ETP-4304.
- Field labels, UI chrome, process parameter names → ETP-3647.
- Any new translations content (we rely on existing `AD_Message_Trl` rows).

---

## 5. Implementation outline

### 5.1 Frontend (`schema-forge`)
- Ensure the GO locale param (from `LocaleProvider`) is present on requests that
  return backend messages — ideally the same convention as ETP-4304 so there's one
  language-passing pattern.

### 5.2 Backend Java (`com.etendoerp.go`)
- Identify the NEO paths that surface `AD_Message` text (process execution,
  callouts, validation errors).
- Apply the GO language (setLanguage with try/finally, or explicit-language API).

### 5.3 DB-procedure-sourced messages
- Find where NEO catches DB-procedure SQLExceptions and builds error responses.
- Ensure that translation step runs under the GO language (via the §3.1 session
  language, or an explicit `language` arg to `translateError`/`messageBD`).
- Audit for any direct `AD_MESSAGE_GET`-style PL/SQL calls that take a `language`
  argument; pass the GO language there too (per-call, no connection change).

---

## 6. Test plan
- **Java messages:** with `lang=es_ES`, a process/validation message returns
  Spanish text; with `lang=en_US`, English; missing `_Trl` row → base fallback.
- **DB-procedure messages:** trigger a PL/SQL error whose code maps to a translated
  `AD_Message`; the response text is in the GO language (the previously-broken case).
- **Context/session isolation:** after a request, the Java `OBContext`/`vars`
  language is restored (no leak to other requests).
- **Fallback:** no empty message text and no error when a translation is missing.

---

## 7. Risks / open points
- The Java source of `com.etendoerp.go` is **not checked out** here (only `web/`).
  The investigation needs the go repo (and Etendo core to confirm `translateError`/
  `messageBD` signatures and any direct-`AD_MESSAGE_GET` PL/SQL).
- Main remaining unknown is **which Java call/language** NEO uses today when turning
  DB-procedure SQLExceptions into responses — not a connection-level problem.
- Watch for PL/SQL that returns **already-translated** text via an `AD_MESSAGE_GET`
  -style call with a `language` argument — those need the GO language passed per call.
- Some messages are assembled by token substitution (`@col@`, `@key@`); verify each
  path actually resolves through `AD_Message`/`AD_Message_Trl` translation in Java.
- Requested language must be an **active system language**
  (`AD_Language.issystemlanguage = 'Y'`) or there are no `_Trl` rows to resolve.
- Current DB instance has empty `_Trl` tables for non-base languages
  (per `docs/etendo-ad/localization.md`); validation needs an instance with `es_ES`
  activated and translated `AD_Message` data.

---

## 8. Relationship to ETP-4304
Same root cause (Classic session language vs GO locale), shared frontend
language-passing convention, and — after the §2 correction — the **same Java-side
mechanism**: set the session/`OBContext` language (or pass it explicitly) so
translation resolves in the GO locale. ETP-4304 covers selector identifiers; this
task covers `AD_Message` text, including PL/SQL-sourced error codes that are
translated in Java. The PL/SQL side is **not** a separate connection-level problem.

If both tasks adopt `OBContext.setLanguage(requestedLang)` at the NEO request
boundary, a single shared helper could cover identifiers **and** messages — worth
considering so the two tasks don't implement the language switch twice.

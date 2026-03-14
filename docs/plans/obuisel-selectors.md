# Plan: OBUISEL Selector Support in NEO Headless

**Created:** 2026-03-13
**Status:** Pending
**ETP:** TBD

## Problem

NEO Headless selector endpoint (`/sws/neo/{spec}/{entity}/selectors/{column}`) currently only supports **simple selectors** (TableDir, Table). OBUISEL selectors return `{"error":{"message":"Custom HQL selectors not supported yet","status":400}}`.

## Impact

Many FK fields use OBUISEL (Warehouse, Business Partner, Project, Asset, Cost Center, User Dimensions). These dropdowns can't be populated from the API yet.

## Root Cause

OBUISEL selectors use custom HQL/SQL defined in `OBUISEL_Selector` table with complex filtering, paging, and column definitions. The current `NeoSelectorService` only handles TableDir and Table reference types.

## Implementation Plan

1. In `NeoSelectorService.java`, add a handler for OBUISEL reference type
2. Read `OBUISEL_Selector` config (HQL, table, display column, value column)
3. Execute the HQL with proper OBContext (org, client filtering)
4. Support `?q=` search param for typeahead filtering
5. Support `?_startRow=&_endRow=` for pagination
6. Return same `{ items: [{ id, label }], totalCount }` format as simple selectors

## Workaround

Until implemented, use mock/fallback data for OBUISEL selectors in the frontend.

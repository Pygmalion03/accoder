# Recommendation Catalog Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bundle a 30-entry Chinese recommendation catalog and add selection, select-all, export, and batch deletion to the recommendation catalog view.

**Architecture:** A tracked default catalog acts as a read-only fallback while the ignored runtime catalog stores imports and deletions. Server helpers own catalog export and mutation; the browser view mirrors personal-library selection behavior without mixing the two stores.

**Tech Stack:** Node.js 20, JSON files, Node test runner, vanilla JavaScript, HTML, and CSS.

---

### Task 1: Bundled Chinese Catalog

**Files:**
- Modify: `.gitignore`
- Create: `data/recommendation/default-catalog.json`
- Modify: `src/server/recommendation-catalog.js`
- Modify: `tests/recommendation-catalog.test.js`

- [ ] Add failing tests for default fallback loading and Chinese catalog coverage.
- [ ] Run `node --test tests/recommendation-catalog.test.js` and verify the new tests fail.
- [ ] Add the tracked 30-entry default catalog and runtime-file fallback.
- [ ] Run the recommendation catalog tests and verify they pass.

### Task 2: Export and Delete APIs

**Files:**
- Modify: `src/server/recommendation-catalog.js`
- Modify: `src/server/server.js`
- Modify: `tests/recommendation-catalog.test.js`
- Modify: `tests/daily-plan-api.test.js`

- [ ] Add failing tests for selected/all export, batch deletion, persisted empty state, and API downloads.
- [ ] Run the targeted tests and verify the failures describe missing behavior.
- [ ] Implement catalog export and deletion helpers plus GET export and DELETE catalog routes.
- [ ] Run the targeted tests and verify they pass.

### Task 3: Catalog Selection UI

**Files:**
- Modify: `web/index.html`
- Modify: `web/app.js`
- Modify: `web/styles.css`
- Modify: `tests/frontend-redesign.test.js`

- [ ] Add failing source-contract tests for Import, Export, Select Problems, Select All, and Delete Selected controls.
- [ ] Run `node --test tests/frontend-redesign.test.js` and verify the new assertions fail.
- [ ] Implement independent catalog selection state, checkbox rows, select-all toggle, export, deletion, and responsive toolbar styling.
- [ ] Change the catalog description and target-tag placeholder to Chinese wording.
- [ ] Run the frontend tests and verify they pass.

### Task 4: Delivery Verification

**Files:**
- Verify all changed files
- Update local runtime `data/recommendation/catalog.json`

- [ ] Run `npm test` in the worktree.
- [ ] Commit implementation changes locally without pushing.
- [ ] Transfer the commits to `submission/25126627/code` and run `npm test` there.
- [ ] Replace the local five-entry English demo catalog with the bundled Chinese catalog.
- [ ] Restart port `43117` and verify catalog count, Chinese titles, export, deletion, and the live UI API.


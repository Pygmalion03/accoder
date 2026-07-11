# Full Practice Statement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make daily recommendations display complete LeetCode statements in the full Practice view while keeping the extension side panel compact.

**Architecture:** A new server-side LeetCode client fetches and normalizes question data. The daily-plan action route uses a local-memory-first resolver, fetches only when needed, and saves only complete pages. Both first-time add and later reopen use the same endpoint so existing placeholder records are repaired.

**Tech Stack:** Node.js 20, built-in `fetch`, Node test runner, existing JSONL memory store, vanilla browser JavaScript.

---

### Task 1: LeetCode Question Client

**Files:**
- Create: `src/server/leetcode-question.js`
- Create: `tests/leetcode-question.test.js`

- [ ] Write tests for translated statement selection, HTML-to-text conversion, metadata normalization, sample extraction, HTTP failure, and missing-question responses.
- [ ] Run `node --test tests/leetcode-question.test.js` and verify the tests fail because the module does not exist.
- [ ] Implement `fetchLeetCodeQuestionPage(slug, url, { fetch })` with the existing `questionData` GraphQL fields.
- [ ] Run `node --test tests/leetcode-question.test.js` and verify all client tests pass.

### Task 2: Local-First Practice Resolution

**Files:**
- Modify: `src/server/server.js`
- Modify: `tests/daily-plan-api.test.js`

- [ ] Replace the placeholder assertion with a failing integration test that injects a LeetCode page fetcher and expects complete content in memory.
- [ ] Add a failing integration test proving a previously captured complete page is reused without a network request.
- [ ] Add a failing integration test proving an old placeholder is ignored and repaired by a fresh complete page.
- [ ] Add a failing integration test proving fetch failure does not append placeholder content or mark the item added.
- [ ] Run `node --test tests/daily-plan-api.test.js` and verify failures match the missing resolution behavior.
- [ ] Add an injectable `fetchLeetCodePage` server dependency and resolve local complete memory before calling it.
- [ ] Save only newly fetched complete pages; update plan/profile actions only after statement resolution succeeds.
- [ ] Run `node --test tests/daily-plan-api.test.js` and verify all daily-plan API tests pass.

### Task 3: Reopen and Repair Existing Recommendations

**Files:**
- Modify: `web/app.js`
- Modify: `tests/frontend-redesign.test.js`

- [ ] Add a failing frontend source-contract test requiring the `practice` action to call the server before opening the problem.
- [ ] Run `node --test tests/frontend-redesign.test.js` and verify the new assertion fails.
- [ ] Route both `add_to_practice` and `practice` through `add_to_practice` on the API, then reload and open the full Practice view.
- [ ] Run `node --test tests/frontend-redesign.test.js` and verify it passes.

### Task 4: Verification

**Files:**
- Verify: all changed source and test files

- [ ] Run `npm test` and verify the complete suite passes.
- [ ] Restart the local server on port `43117`.
- [ ] Call the local API for a recommendation and verify the saved memory page contains a real statement rather than the old English placeholder.
- [ ] Confirm `git status --short` contains only the intended changes plus the user's pre-existing untracked workbook.


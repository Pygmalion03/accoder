# LeetCode Sample Input Handling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop LeetCode core-function examples from being executed as ACM standard input while preserving real ACM cases and user-edited workspace input.

**Architecture:** Add pure sample-selection helpers to `web/view-state.js` and cover them with Node tests. The browser UI consumes the helper, displays a short inline note, and removes only stale cached input that exactly matches the old automatically loaded LeetCode example.

**Tech Stack:** Vanilla browser JavaScript, HTML/CSS, Node.js 20 built-in test runner.

---

### Task 1: Define Executable Sample Rules

**Files:**
- Modify: `web/view-state.js`
- Modify: `tests/frontend-redesign.test.js`

- [x] Add failing tests proving a memory problem returns empty executable fields and an explanatory note, a seed problem returns its first ACM case, and only an exact old LeetCode sample cache is considered stale.
- [x] Run `node --test tests/frontend-redesign.test.js` and verify the new assertions fail because the helpers are not exported.
- [x] Implement `sampleIoForProblem(problem)` and `isStaleLeetCodeSampleCache(problem, workspace)` as pure helpers.
- [x] Run `node --test tests/frontend-redesign.test.js` and verify all frontend behavior tests pass.

### Task 2: Apply the Rules in the Practice View

**Files:**
- Modify: `web/index.html`
- Modify: `web/styles.css`
- Modify: `web/app.js`
- Modify: `tests/web-copy.test.js`

- [x] Add failing source-contract tests for the inline sample note and the new helper integration.
- [x] Run `node --test tests/web-copy.test.js` and verify the new assertions fail.
- [x] Add the `sample-io-note` status element and restrained supporting style.
- [x] Update `restoreSampleIo()` to use `sampleIoForProblem`, show its note, and clear an exact stale LeetCode sample after workspace restoration.
- [x] Run `node --test tests/frontend-redesign.test.js tests/web-copy.test.js` and verify both files pass.

### Task 3: Verify and Synchronize Submission Code

**Files:**
- Verify: all changed source and test files
- Synchronize: `E:/Projects/acmcoder/submission/25126627/code`

- [x] Run `npm test` in the development worktree and verify the complete suite passes.
- [ ] Copy only the reviewed changed files into the submission repository and run `npm test` there.
- [ ] Restart the local app and verify Two Sum no longer loads `nums = [...]` into `stdin`, while a seed problem still loads its ACM test case.
- [ ] Confirm Git status contains only intended changes plus the user's pre-existing untracked workbook.

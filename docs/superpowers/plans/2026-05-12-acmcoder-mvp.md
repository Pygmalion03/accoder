# ACMCoder MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local-first ACM practice MVP with seed problem data, a real local runner, a CLI, and a small Web workbench.

**Architecture:** Problem metadata and sample cases live in repository files. A Node.js runner module compiles or executes user code with local Java/C++/Python toolchains, compares stdout with expected output, and is reused by both CLI and HTTP server. The Web UI calls the local HTTP API instead of executing code in the browser.

**Tech Stack:** Node.js ESM, built-in `node:test`, built-in `http`, local `javac`/`java`, `g++`, and `python` commands.

---

## File Structure

- `package.json`: npm scripts and CLI bin registration.
- `README.md`: project usage, limitations, and first-run commands.
- `data/problems.json`: seed problem metadata and ACM protocols.
- `problems/<slug>/cases/*.in|*.out`: fixed sample cases.
- `problems/<slug>/templates/*`: starter `Main` files for Java/C++/Python.
- `src/core/problems.js`: load and query problem metadata.
- `src/core/output.js`: normalize and compare ACM output.
- `src/runner/toolchains.js`: language definitions and toolchain checks.
- `src/runner/run.js`: compile, execute, timeout, and evaluate submissions.
- `src/server/server.js`: local HTTP API and static file server.
- `bin/acmcoder.js`: CLI command parser.
- `web/index.html`, `web/styles.css`, `web/app.js`: local workbench.
- `tests/*.test.js`: core behavior tests.

## Task 1: Project Skeleton And Seed Data

**Files:**
- Create: `package.json`
- Create: `README.md`
- Create: `data/problems.json`
- Create: `problems/two-sum/cases/1.in`
- Create: `problems/two-sum/cases/1.out`

- [ ] **Step 1: Create metadata and sample files**

Create 5 seed problems with `slug`, `frontendId`, `title`, `difficulty`, `tags`, `rank`, `leetcode`, `acm`, and `cases`. Use hand-written ACM protocols and sample data.

- [ ] **Step 2: Verify JSON is valid**

Run: `node -e "JSON.parse(require('fs').readFileSync('data/problems.json','utf8')); console.log('ok')"`

Expected: prints `ok`.

## Task 2: Core Problem And Output Tests

**Files:**
- Create: `tests/problems.test.js`
- Create: `tests/output.test.js`
- Create: `src/core/problems.js`
- Create: `src/core/output.js`

- [ ] **Step 1: Write failing tests**

Test that problems can be loaded by slug and that ACM output comparison ignores line endings and trailing whitespace while preserving meaningful differences.

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test`

Expected: fails with module-not-found errors for `src/core/problems.js` and `src/core/output.js`.

- [ ] **Step 3: Implement minimal modules**

Implement `loadProblems()`, `findProblem(slugOrId)`, `normalizeOutput()`, and `compareOutput(actual, expected)`.

- [ ] **Step 4: Run tests to verify pass**

Run: `npm test`

Expected: all tests pass.

## Task 3: Runner And Toolchain Checks

**Files:**
- Create: `tests/toolchains.test.js`
- Create: `src/runner/toolchains.js`
- Create: `src/runner/run.js`

- [ ] **Step 1: Write failing tests**

Test language lookup, unsupported language errors, and command metadata for Java/C++/Python.

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test`

Expected: fails because runner modules are missing.

- [ ] **Step 3: Implement toolchains and runner**

Implement compile/run command generation, temporary working directories, stdin piping, timeout handling, stdout/stderr capture, and output evaluation.

- [ ] **Step 4: Run tests to verify pass**

Run: `npm test`

Expected: all tests pass.

## Task 4: CLI

**Files:**
- Create: `bin/acmcoder.js`

- [ ] **Step 1: Add CLI commands**

Support `list`, `show <slug>`, `doctor`, `test <slug> --lang <lang> --file <path>`, and `run <slug> --lang <lang> --file <path> --input <path> [--expected <path>]`.

- [ ] **Step 2: Run CLI smoke checks**

Run: `node bin/acmcoder.js list`

Expected: prints the 5 seed problems.

Run: `node bin/acmcoder.js show two-sum`

Expected: prints the ACM input and output protocol.

## Task 5: Local HTTP API And Web Workbench

**Files:**
- Create: `src/server/server.js`
- Create: `web/index.html`
- Create: `web/styles.css`
- Create: `web/app.js`

- [ ] **Step 1: Add API**

Support `GET /api/problems`, `GET /api/problems/<slug>`, and `POST /api/run`.

- [ ] **Step 2: Add Web UI**

Render the problem list, selected problem detail, language selector, code editor textarea, custom stdin textarea, optional expected output textarea, and run result panel.

- [ ] **Step 3: Run server smoke check**

Run: `node src/server/server.js`

Expected: server prints `http://127.0.0.1:43117`.

## Task 6: Verification

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Run automated tests**

Run: `npm test`

Expected: all tests pass.

- [ ] **Step 2: Run CLI smoke tests**

Run: `node bin/acmcoder.js list`

Expected: problem list prints without error.

- [ ] **Step 3: Run a real Python sample if Python is installed**

Run: `node bin/acmcoder.js test two-sum --lang python --file problems/two-sum/templates/main.py`

Expected: either `AC` if Python is available or a clear toolchain error if Python is not available.

## Self-Review

The plan covers the design requirements for a local-first MVP: seed data, real runner, CLI, Web API, and Web workbench. It intentionally excludes browser extension, Docker, remote judge, login, and LLM assistance from the first implementation. No task depends on a future placeholder feature.

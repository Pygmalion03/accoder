# ACMCoder Frontend Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the stacked ACMCoder web page with an approved Liquid Glass application shell, a daily-plan home view, grouped navigation, and a focused solid dark coding workspace while preserving all existing behavior.

**Architecture:** Keep the existing static HTML/CSS/ES-module frontend and all server APIs. Add one small pure state module for view IDs and daily progress, one local Lucide icon module, rebuild the semantic page shell around five views, then adapt the existing `app.js` functions to drive those views without rewriting editor, runner, memory, or planner logic.

**Tech Stack:** Node.js 20+, browser ES modules, semantic HTML, CSS Grid/Flexbox, `backdrop-filter` with opaque fallback, local Lucide SVG definitions, Node test runner.

---

## File Map

- Create `web/view-state.js`: pure view normalization, canonical slug matching, and daily completion calculations.
- Create `web/icons.js`: local Lucide icon definitions and DOM hydration; no CDN or runtime network dependency.
- Replace the layout in `web/index.html`: application shell, function bar, Today, Practice, Library, Catalog, and Settings views while preserving existing functional element IDs.
- Modify `web/app.js`: navigation state, view rendering, daily-to-practice flow, catalog rendering, session progress, utility tabs, and accessibility state.
- Replace `web/styles.css`: approved material tokens, glass shell, solid IDE, responsive navigation, reduced motion, and opaque fallback.
- Create `tests/frontend-redesign.test.js`: pure-module and static frontend contracts.
- Modify `tests/web-copy.test.js`: update structural expectations only where the new shell intentionally changes class names; preserve behavioral assertions.

No server, runner, Dockerfile, or compose file is part of this plan.

### Task 1: Add Pure View and Daily Progress State

**Files:**
- Create: `web/view-state.js`
- Create: `tests/frontend-redesign.test.js`

- [ ] **Step 1: Write failing pure-state tests**

Create `tests/frontend-redesign.test.js` with these initial tests:

```js
import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

import {
  APP_VIEWS,
  UTILITY_TABS,
  canonicalProblemSlug,
  dailyPlanProgress,
  normalizeUtilityTab,
  normalizeView,
} from "../web/view-state.js";

test("frontend view state accepts only declared views and tabs", () => {
  assert.deepEqual(APP_VIEWS, ["today", "practice", "library", "catalog", "settings"]);
  assert.deepEqual(UTILITY_TABS, ["test", "result", "assist"]);
  assert.equal(normalizeView("catalog"), "catalog");
  assert.equal(normalizeView("unknown"), "today");
  assert.equal(normalizeUtilityTab("assist"), "assist");
  assert.equal(normalizeUtilityTab("unknown"), "test");
});

test("canonicalProblemSlug removes memory prefix and prefers LeetCode slug", () => {
  assert.equal(canonicalProblemSlug({ slug: "memory:lru-cache" }), "lru-cache");
  assert.equal(canonicalProblemSlug({ slug: "seed-alias", leetcode: { slug: "two-sum" } }), "two-sum");
  assert.equal(canonicalProblemSlug(null), "");
});

test("dailyPlanProgress counts only AC results on the plan local date", () => {
  const plan = {
    date: "2026-07-10",
    items: [{ leetcodeSlug: "two-sum" }, { leetcodeSlug: "lru-cache" }, { leetcodeSlug: "merge-k-sorted-lists" }],
  };
  const problems = [
    { slug: "memory:two-sum", progress: { lastAcceptedAt: "2026-07-10T08:30:00+08:00" } },
    { slug: "memory:lru-cache", progress: { lastAcceptedAt: "2026-07-09T22:00:00+08:00" } },
  ];

  assert.deepEqual(dailyPlanProgress(plan, problems), { completed: 1, total: 3, percent: 33 });
  assert.deepEqual(dailyPlanProgress(null, problems), { completed: 0, total: 0, percent: 0 });
});

test("redesign assets remain local", () => {
  const html = fs.readFileSync("web/index.html", "utf8");
  assert.doesNotMatch(html, /https?:\/\/(?:unpkg|cdn|fonts\.)/i);
});
```

- [ ] **Step 2: Run the tests and verify the missing module failure**

Run:

```powershell
node --test tests/frontend-redesign.test.js
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `web/view-state.js`.

- [ ] **Step 3: Implement `web/view-state.js`**

Create the complete pure module:

```js
export const APP_VIEWS = Object.freeze(["today", "practice", "library", "catalog", "settings"]);
export const UTILITY_TABS = Object.freeze(["test", "result", "assist"]);

export function normalizeView(value) {
  return APP_VIEWS.includes(value) ? value : "today";
}

export function normalizeUtilityTab(value) {
  return UTILITY_TABS.includes(value) ? value : "test";
}

export function canonicalProblemSlug(problem) {
  const value = problem?.leetcode?.slug || problem?.slug || "";
  return String(value).replace(/^memory:/, "");
}

export function localDateForTimestamp(value) {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function dailyPlanProgress(plan, problems = []) {
  const items = Array.isArray(plan?.items) ? plan.items : [];
  const acceptedToday = new Set(
    problems
      .filter((problem) => localDateForTimestamp(problem?.progress?.lastAcceptedAt) === plan?.date)
      .map(canonicalProblemSlug)
      .filter(Boolean),
  );
  const completed = items.filter((item) => acceptedToday.has(String(item?.leetcodeSlug || ""))).length;
  const total = items.length;
  return {
    completed,
    total,
    percent: total ? Math.round((completed / total) * 100) : 0,
  };
}
```

- [ ] **Step 4: Run the focused tests**

Run:

```powershell
node --test tests/frontend-redesign.test.js
```

Expected: 4 tests PASS.

- [ ] **Step 5: Commit the pure state module**

```powershell
git add web/view-state.js tests/frontend-redesign.test.js
git commit -m "feat: add frontend view state"
```

### Task 2: Build the Semantic Application Shell and Local Icons

**Files:**
- Create: `web/icons.js`
- Modify: `web/index.html`
- Modify: `tests/frontend-redesign.test.js`

- [ ] **Step 1: Add failing shell and icon assertions**

Append these tests:

```js
test("web shell declares the five product views and grouped navigation", () => {
  const html = fs.readFileSync("web/index.html", "utf8");
  for (const view of APP_VIEWS) {
    assert.match(html, new RegExp(`id="view-${view}"`));
    assert.match(html, new RegExp(`data-view-target="${view}"`));
  }
  assert.match(html, /id="app-navigation"/);
  assert.match(html, /data-nav-group="smart-practice"/);
  assert.match(html, /data-nav-group="workspace"/);
  assert.match(html, /data-nav-group="system"/);
  assert.match(html, /aria-live="polite"/);
});

test("web shell preserves all existing behavior-bearing IDs", () => {
  const html = fs.readFileSync("web/index.html", "utf8");
  const ids = [
    "search", "problem-list", "select-problems", "delete-problems", "export-problems", "import-problems",
    "problem-title", "eyebrow", "leetcode-link", "problem-description", "language", "runner", "runner-health",
    "load-template", "run", "code-editor", "line-numbers", "code-highlight", "code", "stdin", "expected",
    "sample-io", "clear-expected", "status", "message", "stdout", "stderr", "assist-key", "assist-base-url",
    "assist-model", "save-assist-settings", "assist-question", "ask-assist", "assist-answer", "daily-count",
    "daily-difficulty", "daily-tags", "generate-daily", "import-catalog", "catalog-file", "daily-status", "daily-list",
  ];
  for (const id of ids) assert.match(html, new RegExp(`id="${id}"`));
});

test("local Lucide module exposes the icons used by the shell", async () => {
  const icons = await import("../web/icons.js");
  for (const name of ["home", "sparkles", "code-2", "library-big", "settings", "search", "external-link", "play", "upload", "download", "trash-2"]) {
    assert.match(icons.iconMarkup(name), /<svg/);
  }
  assert.equal(icons.iconMarkup("missing"), "");
});
```

- [ ] **Step 2: Run the focused test and verify structural failures**

Run:

```powershell
node --test tests/frontend-redesign.test.js
```

Expected: FAIL because the five views and `web/icons.js` do not exist.

- [ ] **Step 3: Create the local Lucide icon module**

Create `web/icons.js` using official Lucide path data for exactly these icons:

```js
const ICONS = {
  home: '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/><polyline points="9 22 9 12 15 12 15 22"/>',
  sparkles: '<path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/>',
  "code-2": '<path d="m18 16 4-4-4-4"/><path d="m6 8-4 4 4 4"/><path d="m14.5 4-5 16"/>',
  "library-big": '<rect width="8" height="18" x="3" y="3" rx="1"/><path d="M7 3v18"/><path d="M20.4 18.9c.2.5-.1 1.1-.6 1.3l-3.7 1.3c-.5.2-1.1-.1-1.3-.6L9.1 5.1c-.2-.5.1-1.1.6-1.3l3.7-1.3c.5-.2 1.1.1 1.3.6Z"/>',
  settings: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.09a2 2 0 0 1-1-1.74v-.51a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2Z"/><circle cx="12" cy="12" r="3"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  "external-link": '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  play: '<polygon points="6 3 20 12 6 21 6 3"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>',
  "trash-2": '<path d="M3 6h18"/><path d="M8 6V4c0-1 .9-2 2-2h4c1.1 0 2 1 2 2v2"/><path d="m19 6-1 14c-.1 1.1-1 2-2 2H8c-1 0-1.9-.9-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/>',
};

export function iconMarkup(name, label = "") {
  const body = ICONS[name];
  if (!body) return "";
  const aria = label ? `role="img" aria-label="${label}"` : 'aria-hidden="true"';
  return `<svg ${aria} viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
}

export function hydrateIcons(root = document) {
  for (const element of root.querySelectorAll("[data-icon]")) {
    element.innerHTML = iconMarkup(element.dataset.icon, element.dataset.iconLabel || "");
  }
}
```

- [ ] **Step 4: Replace `web/index.html` with the five-view shell**

Use this exact top-level structure and move every preserved behavior-bearing control into the named view:

```html
<body data-active-view="today">
  <main class="app-shell">
    <aside id="app-navigation" class="app-nav" aria-label="主要功能">
      <a class="brand" href="#today" data-view-target="today" aria-label="ACMCoder 今日计划">
        <span class="brand-mark">A</span><span class="brand-copy">ACMCoder</span>
      </a>
      <nav>
        <section data-nav-group="smart-practice" aria-labelledby="nav-smart-title">
          <h2 id="nav-smart-title">智能练习</h2>
          <button type="button" data-view-target="today" aria-current="page"><span data-icon="home"></span><span>今日计划</span><b>AI</b></button>
          <button type="button" data-view-target="catalog"><span data-icon="sparkles"></span><span>推荐题库</span></button>
        </section>
        <section data-nav-group="workspace" aria-labelledby="nav-workspace-title">
          <h2 id="nav-workspace-title">工作区</h2>
          <button type="button" data-view-target="practice"><span data-icon="code-2"></span><span>代码运行器</span></button>
          <button type="button" data-view-target="library"><span data-icon="library-big"></span><span>我的题库</span><b id="library-count">0</b></button>
        </section>
        <section data-nav-group="system" aria-labelledby="nav-system-title">
          <h2 id="nav-system-title">系统</h2>
          <button type="button" data-view-target="settings"><span data-icon="settings"></span><span>模型与数据</span></button>
        </section>
      </nav>
      <div class="nav-health"><span class="health-dot"></span><span id="nav-runner-health">检测运行环境...</span></div>
    </aside>

    <section class="app-content">
      <header class="global-bar">
        <p id="current-date"></p>
        <div class="global-actions">
          <button id="global-search" type="button" title="搜索我的题库" aria-label="搜索我的题库"><span data-icon="search"></span></button>
          <button type="button" data-view-target="settings" title="模型与数据设置" aria-label="模型与数据设置"><span data-icon="settings"></span></button>
        </div>
      </header>

      <section id="view-today" class="app-view" data-view="today" tabindex="-1" aria-labelledby="today-title"></section>
      <section id="view-practice" class="app-view" data-view="practice" tabindex="-1" aria-labelledby="problem-title" hidden></section>
      <section id="view-library" class="app-view" data-view="library" tabindex="-1" aria-labelledby="library-title" hidden></section>
      <section id="view-catalog" class="app-view" data-view="catalog" tabindex="-1" aria-labelledby="catalog-title" hidden></section>
      <section id="view-settings" class="app-view" data-view="settings" tabindex="-1" aria-labelledby="settings-title" hidden></section>
    </section>
  </main>
  <nav id="mobile-navigation" class="mobile-nav" aria-label="移动端主要功能">
    <button type="button" data-view-target="today"><span data-icon="home"></span><span>今日</span></button>
    <button type="button" data-view-target="practice"><span data-icon="code-2"></span><span>练习</span></button>
    <button type="button" data-view-target="library"><span data-icon="library-big"></span><span>题库</span></button>
    <button id="mobile-more-toggle" type="button" aria-expanded="false" aria-controls="mobile-more-menu"><span data-icon="settings"></span><span>更多</span></button>
  </nav>
  <div id="mobile-more-menu" class="mobile-more-menu" hidden>
    <button type="button" data-view-target="catalog"><span data-icon="sparkles"></span><span>推荐题库</span></button>
    <button type="button" data-view-target="settings"><span data-icon="settings"></span><span>模型与数据</span></button>
  </div>
  <script type="module" src="/app.js"></script>
</body>
```

Inside `view-today`, place the existing daily controls and hidden catalog file input, plus `#daily-progress-count`, `#daily-progress-bar`, and `#daily-plan-source`.

Inside `view-practice`, place the problem command bar, `#daily-session`, collapsible `#problem-inspector`, editor, and utility tabs. Move all existing editor, test, result, and assist IDs here without renaming them. Add `#toggle-problem-inspector`, `.editor-pane`, and these mobile tabs:

```html
<div class="mobile-practice-tabs" role="tablist" aria-label="练习工作区">
  <button type="button" data-mobile-practice-tab="problem">题目</button>
  <button type="button" data-mobile-practice-tab="code" aria-selected="true">代码</button>
  <button type="button" data-mobile-practice-tab="result">结果</button>
</div>
```

The utility dock uses three tab buttons with `data-utility-tab="test|result|assist"` and matching panels with `data-utility-panel="test|result|assist"`. Give the result panel both `utility-panel` and `result` classes so the opaque terminal CSS contract is exact.

Inside `view-library`, place `#search`, all batch actions, `#import-file`, and `#problem-list`.

Inside `view-catalog`, add `#catalog-import`, `#catalog-status` with `aria-live="polite"`, and `#catalog-list`. `#catalog-import` triggers the single existing `#catalog-file` input.

Inside `view-settings`, place the existing model settings fields and add `#settings-import-problems` and `#settings-export-problems`. These buttons call the existing import and export flows; they do not duplicate file inputs or API logic.

Keep all status elements that change asynchronously, including `#daily-status`, `#runner-health`, `#status`, and `#catalog-status`, inside `aria-live="polite"` containers.

- [ ] **Step 5: Run the focused shell tests**

Run:

```powershell
node --test tests/frontend-redesign.test.js
```

Expected: all tests PASS.

- [ ] **Step 6: Commit the shell**

```powershell
git add web/index.html web/icons.js tests/frontend-redesign.test.js
git commit -m "feat: add redesigned application shell"
```

### Task 3: Wire Navigation, Library, Settings, and Utility Tabs

**Files:**
- Modify: `web/app.js`
- Modify: `tests/frontend-redesign.test.js`

- [ ] **Step 1: Add failing navigation wiring assertions**

Append:

```js
test("web app wires view navigation and utility tabs", () => {
  const script = fs.readFileSync("web/app.js", "utf8");
  assert.match(script, /activeView:\s*"today"/);
  assert.match(script, /activeUtilityTab:\s*"test"/);
  assert.match(script, /function setActiveView/);
  assert.match(script, /function setUtilityTab/);
  assert.match(script, /data-view-target/);
  assert.match(script, /data-utility-tab/);
  assert.match(script, /aria-current/);
  assert.match(script, /hydrateIcons/);
});
```

- [ ] **Step 2: Run and verify the test fails**

Run:

```powershell
node --test tests/frontend-redesign.test.js
```

Expected: FAIL because navigation functions are absent.

- [ ] **Step 3: Import modules and extend state/elements**

At the top of `web/app.js`:

```js
import { hydrateIcons } from "./icons.js";
import { canonicalProblemSlug, dailyPlanProgress, normalizeUtilityTab, normalizeView } from "./view-state.js";
```

Extend `state`:

```js
activeView: "today",
activeUtilityTab: "test",
mobilePracticeTab: "code",
problemInspectorOpen: false,
mobileMoreOpen: false,
catalog: [],
```

Extend `elements` with:

```js
appViews: [...document.querySelectorAll("[data-view]")],
viewTargets: [...document.querySelectorAll("[data-view-target]")],
utilityTabs: [...document.querySelectorAll("[data-utility-tab]")],
utilityPanels: [...document.querySelectorAll("[data-utility-panel]")],
mobilePracticeTabs: [...document.querySelectorAll("[data-mobile-practice-tab]")],
mobileMoreToggle: document.querySelector("#mobile-more-toggle"),
mobileMoreMenu: document.querySelector("#mobile-more-menu"),
globalSearch: document.querySelector("#global-search"),
currentDate: document.querySelector("#current-date"),
libraryCount: document.querySelector("#library-count"),
navRunnerHealth: document.querySelector("#nav-runner-health"),
dailySession: document.querySelector("#daily-session"),
dailyProgressCount: document.querySelector("#daily-progress-count"),
dailyProgressBar: document.querySelector("#daily-progress-bar"),
dailyPlanSource: document.querySelector("#daily-plan-source"),
catalogStatus: document.querySelector("#catalog-status"),
catalogList: document.querySelector("#catalog-list"),
catalogImport: document.querySelector("#catalog-import"),
toggleProblemInspector: document.querySelector("#toggle-problem-inspector"),
problemInspector: document.querySelector("#problem-inspector"),
settingsImportProblems: document.querySelector("#settings-import-problems"),
settingsExportProblems: document.querySelector("#settings-export-problems"),
```

- [ ] **Step 4: Implement view and utility tab controllers**

Add:

```js
function setActiveView(view, { focus = false } = {}) {
  const nextView = normalizeView(view);
  state.activeView = nextView;
  document.body.dataset.activeView = nextView;

  for (const panel of elements.appViews) {
    const active = panel.dataset.view === nextView;
    panel.hidden = !active;
    panel.classList.toggle("is-active", active);
    if (active && focus) panel.focus({ preventScroll: true });
  }

  for (const target of elements.viewTargets) {
    const active = target.dataset.viewTarget === nextView;
    if (active) target.setAttribute("aria-current", "page");
    else target.removeAttribute("aria-current");
  }
}

function setUtilityTab(tab) {
  const nextTab = normalizeUtilityTab(tab);
  state.activeUtilityTab = nextTab;
  for (const target of elements.utilityTabs) {
    const active = target.dataset.utilityTab === nextTab;
    target.setAttribute("aria-selected", String(active));
    target.tabIndex = active ? 0 : -1;
  }
  for (const panel of elements.utilityPanels) {
    panel.hidden = panel.dataset.utilityPanel !== nextTab;
  }
}

function updateLibraryCount() {
  elements.libraryCount.textContent = String(state.problems.length);
}

function setMobileMoreOpen(open) {
  state.mobileMoreOpen = Boolean(open);
  elements.mobileMoreMenu.hidden = !state.mobileMoreOpen;
  elements.mobileMoreToggle.setAttribute("aria-expanded", String(state.mobileMoreOpen));
}
```

Update `setRunnerHealth` so it mirrors the plain-text message into `elements.navRunnerHealth`.

- [ ] **Step 5: Bind navigation and utility events in `init`**

Add before data loading:

```js
hydrateIcons();
elements.currentDate.textContent = new Intl.DateTimeFormat("zh-CN", { dateStyle: "full" }).format(new Date());

for (const target of elements.viewTargets) {
  target.addEventListener("click", () => {
    setMobileMoreOpen(false);
    setActiveView(target.dataset.viewTarget, { focus: true });
  });
}
for (const target of elements.utilityTabs) {
  target.addEventListener("click", () => setUtilityTab(target.dataset.utilityTab));
}
elements.globalSearch.addEventListener("click", () => {
  setActiveView("library", { focus: true });
  elements.search.focus();
});
elements.mobileMoreToggle.addEventListener("click", () => setMobileMoreOpen(!state.mobileMoreOpen));
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") setMobileMoreOpen(false);
});
elements.catalogImport.addEventListener("click", () => elements.catalogFile.click());
elements.settingsImportProblems.addEventListener("click", () => elements.importFile.click());
elements.settingsExportProblems.addEventListener("click", () => {
  exportProblems().catch((error) => setResult({ status: "ERROR", message: error.message, stdout: "", stderr: "" }));
});
```

Change `reloadProblems` to `async function reloadProblems({ preserveView = false } = {})`. When it must select a fallback, call `selectProblem(fallback.slug, { openView: !preserveView })`. Call `updateLibraryCount()` after every problem load/import/delete path. Call `setActiveView("today")` and `setUtilityTab("test")` at the end of initialization so selecting the cached problem in the background does not replace Today.

- [ ] **Step 6: Run focused and existing frontend tests**

Run:

```powershell
node --test tests/frontend-redesign.test.js tests/web-copy.test.js
```

Expected: navigation tests PASS; any old class-name assertions fail only where the shell intentionally changed and are updated in Task 6.

- [ ] **Step 7: Commit navigation wiring**

```powershell
git add web/app.js tests/frontend-redesign.test.js
git commit -m "feat: wire application navigation"
```

### Task 4: Redesign Today and Add the Read-Only Catalog View

**Files:**
- Modify: `web/app.js`
- Modify: `tests/frontend-redesign.test.js`

- [ ] **Step 1: Add failing Today and catalog assertions**

Append:

```js
test("Today exposes honest source, progress, and add-to-practice flow", () => {
  const script = fs.readFileSync("web/app.js", "utf8");
  assert.match(script, /dailyPlanProgress/);
  assert.match(script, /renderDailyProgress/);
  assert.match(script, /打开原题/);
  assert.match(script, /加入并练习/);
  assert.match(script, /memory:\$\{slug\}/);
  assert.match(script, /setActiveView\("practice"/);
});

test("catalog view is imported from the existing API and remains read-only", () => {
  const script = fs.readFileSync("web/app.js", "utf8");
  assert.match(script, /api\/recommendation\/catalog/);
  assert.match(script, /function renderRecommendationCatalog/);
  assert.doesNotMatch(script, /sync-codetop/);
});
```

- [ ] **Step 2: Run and verify the new tests fail**

Run:

```powershell
node --test tests/frontend-redesign.test.js
```

Expected: FAIL on missing progress/catalog rendering.

- [ ] **Step 3: Implement honest daily progress**

Add:

```js
function renderDailyProgress() {
  const progress = dailyPlanProgress(state.dailyPlan, state.problems);
  elements.dailyProgressCount.textContent = `${progress.completed}/${progress.total}`;
  elements.dailyProgressBar.style.width = `${progress.percent}%`;
  elements.dailyProgressBar.parentElement.setAttribute("aria-valuenow", String(progress.completed));
  elements.dailyProgressBar.parentElement.setAttribute("aria-valuemax", String(progress.total || 1));
}
```

Call it from `renderDailyPlan`, after problem reloads, and after AC progress updates in `runCode`.

Set `#daily-plan-source` to `AI 推荐` when `plan.source === "ai"`, otherwise `本地规则`.

- [ ] **Step 4: Replace daily row actions**

In `renderDailyPlan`, keep skip and mastered inside an overflow menu or secondary action group, and render these two primary actions exactly:

```js
<a class="icon-command secondary" href="${escapeHtml(item.leetcodeUrl)}" target="_blank" rel="noreferrer"
   data-daily-action="open" data-slug="${escapeHtml(item.leetcodeSlug)}">
  ${iconMarkup("external-link")}<span>打开原题</span>
</a>
<button type="button" data-daily-action="${addedToPractice ? "practice" : "add_to_practice"}" data-slug="${escapeHtml(item.leetcodeSlug)}">
  ${iconMarkup("code-2")}<span>${addedToPractice ? "打开练习" : "加入并练习"}</span>
</button>
```

Import `iconMarkup` alongside `hydrateIcons`.

Add a local helper, then update `recordDailyAction`:

```js
async function openPracticeForRecommendation(slug) {
  const practiceSlug = `memory:${slug}`;
  if (!state.problems.some((problem) => problem.slug === practiceSlug)) return false;
  await selectProblem(practiceSlug, { openView: false });
  setActiveView("practice", { focus: true });
  return true;
}

if (action === "add_to_practice") {
  await reloadProblems({ preserveView: true });
  await openPracticeForRecommendation(slug);
}
```

In the delegated daily-list click handler, handle `action === "practice"` by calling `openPracticeForRecommendation(slug)` and returning before `recordDailyAction`. This prevents a second planner API call after the item is already in the library.

- [ ] **Step 5: Implement catalog loading and rendering**

Add:

```js
function setCatalogStatus(message, kind = "") {
  elements.catalogStatus.textContent = message;
  elements.catalogStatus.className = `catalog-status ${kind}`.trim();
}

function renderRecommendationCatalog(catalog) {
  state.catalog = Array.isArray(catalog?.entries) ? catalog.entries : [];
  elements.catalogList.innerHTML = "";
  if (state.catalog.length === 0) {
    setCatalogStatus("尚未导入推荐题库。请选择兼容的 JSON 文件。", "empty");
    return;
  }
  setCatalogStatus(`已导入 ${state.catalog.length} 道推荐题。`, "ok");
  for (const item of state.catalog) {
    const row = document.createElement("article");
    row.className = "catalog-row";
    row.innerHTML = `
      <div><b>#${escapeHtml(item.sourceRank || "-")}</b><h3>${escapeHtml(item.title)}</h3></div>
      <p>${escapeHtml([item.difficulty, ...(item.tags || [])].filter(Boolean).join(" · "))}</p>
      <a href="${escapeHtml(item.leetcodeUrl)}" target="_blank" rel="noreferrer">${iconMarkup("external-link")}<span>打开原题</span></a>`;
    elements.catalogList.appendChild(row);
  }
}

async function loadRecommendationCatalog() {
  const body = await getJson("/api/recommendation/catalog");
  renderRecommendationCatalog(body.catalog);
}
```

After successful import, call `loadRecommendationCatalog()` and keep the current view.

- [ ] **Step 6: Run focused tests**

Run:

```powershell
node --test tests/frontend-redesign.test.js tests/daily-plan-api.test.js
```

Expected: all tests PASS.

- [ ] **Step 7: Commit Today and catalog**

```powershell
git add web/app.js tests/frontend-redesign.test.js
git commit -m "feat: redesign daily plan and catalog views"
```

### Task 5: Build the Focused Practice Workspace

**Files:**
- Modify: `web/app.js`
- Modify: `tests/frontend-redesign.test.js`

- [ ] **Step 1: Add failing practice-flow assertions**

Append:

```js
test("practice view renders daily session and reveals results after a run", () => {
  const script = fs.readFileSync("web/app.js", "utf8");
  assert.match(script, /function renderDailySession/);
  assert.match(script, /canonicalProblemSlug/);
  assert.match(script, /setUtilityTab\("result"\)/);
  assert.match(script, /function setMobilePracticeTab/);
  assert.match(script, /function setProblemInspectorOpen/);
  assert.match(script, /options\.openView/);
});
```

- [ ] **Step 2: Run and verify failure**

Run:

```powershell
node --test tests/frontend-redesign.test.js
```

Expected: FAIL on missing session/result wiring.

- [ ] **Step 3: Render the daily session strip**

Add:

```js
function renderDailySession() {
  const items = Array.isArray(state.dailyPlan?.items) ? state.dailyPlan.items : [];
  const selectedSlug = canonicalProblemSlug(state.selected);
  const inPlan = items.some((item) => item.leetcodeSlug === selectedSlug);
  elements.dailySession.hidden = !inPlan;
  if (!inPlan) {
    elements.dailySession.innerHTML = "";
    return;
  }
  elements.dailySession.innerHTML = items
    .map((item, index) => {
      const current = item.leetcodeSlug === selectedSlug;
      return `<span class="session-step ${current ? "current" : ""}" ${current ? 'aria-current="step"' : ""}>
        <i>${index + 1}</i><span>${escapeHtml(item.title || item.leetcodeSlug)}</span>
      </span>`;
    })
    .join("");
}
```

Call it from `renderDailyPlan` and `selectProblem`.

- [ ] **Step 4: Make problem selection view-aware**

At the end of `selectProblem`:

```js
renderDailySession();
if (options.openView !== false) setActiveView("practice", { focus: true });
```

During `init`, select the cached fallback with `{ openView: false }` so Today remains the first view. Library row clicks use the default and therefore enter Practice. Extension-captured memory may continue to enter Practice when `autoSelect` is true.

- [ ] **Step 5: Reveal result utility tab after execution**

At the start of `runCode`, call `setUtilityTab("result")` after setting `RUNNING`. After the response, call `renderDailyProgress()` when progress changes.

Keep the existing runner payload and AC progress logic unchanged.

- [ ] **Step 6: Add utility-tab keyboard behavior**

Bind ArrowLeft/ArrowRight on utility tab buttons:

```js
function handleUtilityTabKeydown(event) {
  if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
  event.preventDefault();
  const current = elements.utilityTabs.indexOf(event.currentTarget);
  const delta = event.key === 'ArrowRight' ? 1 : -1;
  const next = elements.utilityTabs[(current + delta + elements.utilityTabs.length) % elements.utilityTabs.length];
  setUtilityTab(next.dataset.utilityTab);
  next.focus();
}
```

- [ ] **Step 7: Wire compact inspector and mobile practice tabs**

Add:

```js
function setProblemInspectorOpen(open) {
  state.problemInspectorOpen = Boolean(open);
  elements.problemInspector.classList.toggle("is-open", state.problemInspectorOpen);
  elements.toggleProblemInspector.setAttribute("aria-expanded", String(state.problemInspectorOpen));
}

function setMobilePracticeTab(tab) {
  const nextTab = ["problem", "code", "result"].includes(tab) ? tab : "code";
  state.mobilePracticeTab = nextTab;
  document.body.dataset.mobilePracticeTab = nextTab;
  for (const target of elements.mobilePracticeTabs) {
    target.setAttribute("aria-selected", String(target.dataset.mobilePracticeTab === nextTab));
  }
  if (nextTab === "result") setUtilityTab("result");
}
```

Bind `#toggle-problem-inspector` to invert `state.problemInspectorOpen`. Bind each mobile practice tab to `setMobilePracticeTab`. When switching away from Practice, call `setProblemInspectorOpen(false)`. When `runCode` starts on a viewport below 760px, call `setMobilePracticeTab("result")`; otherwise only call `setUtilityTab("result")`.

- [ ] **Step 8: Run focused tests**

Run:

```powershell
node --test tests/frontend-redesign.test.js tests/web-copy.test.js
```

Expected: practice-flow assertions PASS; existing editor, runner, assist, and cache assertions remain PASS.

- [ ] **Step 9: Commit the focused workspace behavior**

```powershell
git add web/app.js tests/frontend-redesign.test.js
git commit -m "feat: add focused practice workspace"
```

### Task 6: Apply the Approved Liquid Glass and Solid IDE Styling

**Files:**
- Modify: `web/styles.css`
- Modify: `tests/frontend-redesign.test.js`
- Modify: `tests/web-copy.test.js`

- [ ] **Step 1: Add failing visual contract tests**

Append:

```js
test("redesign CSS keeps material and IDE layers separate", () => {
  const css = fs.readFileSync("web/styles.css", "utf8");
  assert.match(css, /--glass-surface:\s*rgba\(245,\s*249,\s*247,\s*0\.68\)/);
  assert.match(css, /--editor:\s*#0d1113/);
  assert.match(css, /--terminal:\s*#0b0e10/);
  assert.match(css, /\.app-nav[\s\S]*backdrop-filter:/);
  assert.match(css, /\.code-editor[\s\S]*background:\s*var\(--editor\)/);
  assert.match(css, /\.utility-panel\.result[\s\S]*background:\s*var\(--terminal\)/);
  assert.match(css, /@supports not \(backdrop-filter:/);
  assert.match(css, /@media \(prefers-reduced-motion:\s*reduce\)/);
  assert.match(css, /@media \(max-width:\s*1179px\)/);
  assert.match(css, /@media \(max-width:\s*759px\)/);
});
```

- [ ] **Step 2: Run and verify CSS contract failures**

Run:

```powershell
node --test tests/frontend-redesign.test.js
```

Expected: FAIL on missing tokens and selectors.

- [ ] **Step 3: Replace global tokens and shell styling**

Start `web/styles.css` with:

```css
:root {
  color-scheme: light;
  --page-backing: #cbd9d4;
  --glass-surface: rgba(245, 249, 247, 0.68);
  --solid-surface: #f8faf9;
  --ink: #17231f;
  --muted: #68756f;
  --line: rgba(72, 96, 87, 0.24);
  --accent: #176b54;
  --accent-strong: #0e4d41;
  --progress: #ef7657;
  --warn: #ad5b23;
  --bad: #a63f55;
  --good: #176b54;
  --editor: #0d1113;
  --terminal: #0b0e10;
  --editor-line: #252c2f;
  --radius: 8px;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

* { box-sizing: border-box; }
body { margin: 0; min-height: 100vh; background: var(--page-backing); color: var(--ink); }
button, input, select, textarea { font: inherit; }
button:focus-visible, a:focus-visible, input:focus-visible, select:focus-visible, textarea:focus-visible {
  outline: 3px solid rgba(23, 107, 84, 0.28);
  outline-offset: 2px;
}

.app-shell { display: grid; grid-template-columns: 210px minmax(0, 1fr); min-height: 100vh; }
.app-nav {
  position: sticky; top: 0; display: flex; flex-direction: column; height: 100vh;
  border-right: 1px solid var(--line); background: var(--glass-surface);
  box-shadow: inset 0 1px rgba(255,255,255,.74); backdrop-filter: blur(24px) saturate(1.2);
}
.app-content { min-width: 0; background: rgba(248, 250, 249, .78); }
.global-bar { min-height: 66px; border-bottom: 1px solid var(--line); background: rgba(255,255,255,.42); backdrop-filter: blur(20px); }
.app-view { animation: view-enter 180ms ease both; }
@keyframes view-enter { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
```

- [ ] **Step 4: Implement Today, catalog, library, and settings layouts**

Use these stable desktop tracks:

```css
.today-layout { display: grid; grid-template-columns: minmax(0, 1.35fr) minmax(240px, .65fr); gap: 28px; }
.daily-list, .catalog-list, .problem-list { display: grid; }
.daily-item, .catalog-row { display: grid; border-top: 1px solid var(--line); border-radius: 0; background: transparent; }
.daily-progress-track { height: 7px; overflow: hidden; background: rgba(77,104,93,.17); }
.daily-progress-track > span { display: block; height: 100%; background: var(--accent); transition: width 180ms ease; }
.library-layout { display: grid; grid-template-columns: minmax(260px, .7fr) minmax(0, 1.3fr); gap: 22px; }
.settings-layout { max-width: 820px; }
```

Style form controls at 36-40px high, use 6-8px radius, keep row actions compact, and do not wrap routine sections in decorative cards.

- [ ] **Step 5: Implement the solid practice workspace**

Preserve the existing editor overlay selectors and apply:

```css
.practice-command, .daily-session { background: rgba(248,250,249,.82); backdrop-filter: blur(18px); }
.practice-workspace { display: grid; grid-template-columns: minmax(250px, .58fr) minmax(460px, 1.42fr); min-height: calc(100vh - 120px); }
.problem-inspector { border-right: 1px solid var(--line); background: rgba(250,252,251,.88); }
.practice-main { display: grid; grid-template-rows: minmax(360px, 1fr) minmax(158px, auto); min-width: 0; background: var(--editor); }
.code-editor { height: 100%; min-height: 360px; border: 0; border-radius: 0; background: var(--editor); resize: none; }
.utility-dock { border-top: 1px solid var(--editor-line); background: var(--terminal); color: #edf2f0; }
.utility-panel.result { background: var(--terminal); }
.utility-panel.test, .utility-panel.assist { background: #111719; }
```

Retain all existing syntax token, bracket match, selection, line number, and scroll alignment rules.

- [ ] **Step 6: Add material fallback, reduced motion, and responsive modes**

```css
@supports not (backdrop-filter: blur(1px)) {
  .app-nav, .global-bar, .practice-command, .daily-session { background: #eef3f0; }
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { scroll-behavior: auto !important; animation-duration: .01ms !important; transition-duration: .01ms !important; }
}

@media (max-width: 1179px) {
  .app-shell { grid-template-columns: 72px minmax(0, 1fr); }
  .app-nav .brand-copy, .app-nav nav h2, .app-nav nav button > span:last-of-type, .app-nav nav button > b, .nav-health > span:last-child { display: none; }
  .today-layout, .library-layout { grid-template-columns: 1fr; }
  .practice-workspace { grid-template-columns: 1fr; }
  .problem-inspector { position: fixed; inset: 66px auto 0 72px; z-index: 20; width: min(390px, calc(100vw - 72px)); transform: translateX(-110%); }
  .problem-inspector.is-open { transform: translateX(0); }
}

@media (max-width: 759px) {
  .app-shell { display: block; padding-bottom: 62px; }
  .app-nav { display: none; }
  .mobile-nav { position: fixed; z-index: 30; inset: auto 0 0; display: grid; grid-template-columns: repeat(4, 1fr); min-height: 58px; }
  .mobile-more-menu { position: fixed; z-index: 31; right: 10px; bottom: 68px; display: grid; min-width: 190px; border: 1px solid var(--line); border-radius: var(--radius); background: #eef3f0; box-shadow: 0 16px 40px rgba(28,50,42,.2); }
  .mobile-more-menu[hidden] { display: none; }
  .practice-command { align-items: stretch; flex-direction: column; }
  .practice-workspace { min-height: auto; }
  .problem-inspector, .practice-main { position: static; width: auto; transform: none; }
  body[data-mobile-practice-tab="problem"] .practice-main,
  body[data-mobile-practice-tab="code"] .problem-inspector,
  body[data-mobile-practice-tab="code"] .utility-dock,
  body[data-mobile-practice-tab="result"] .problem-inspector,
  body[data-mobile-practice-tab="result"] .editor-pane { display: none; }
  body[data-mobile-practice-tab="result"] .practice-main { grid-template-rows: auto; }
}
```

- [ ] **Step 7: Update obsolete static CSS assertions**

In `tests/web-copy.test.js`, replace assertions for removed `.daily-panel`, `.memory-actions`, and old card wrappers with the new `.today-layout`, `.library-actions`, `.daily-item`, `.practice-workspace`, and `.utility-dock` selectors. Do not remove behavioral assertions for editor alignment, runner modes, doctor status, API paths, model assistance, import/export, or progress.

- [ ] **Step 8: Run frontend and full tests**

Run:

```powershell
node --test tests/frontend-redesign.test.js tests/web-copy.test.js
npm test
```

Expected: focused tests PASS; full suite PASS with no regression.

- [ ] **Step 9: Commit the visual system**

```powershell
git add web/styles.css tests/frontend-redesign.test.js tests/web-copy.test.js
git commit -m "feat: apply glass workspace visual system"
```

### Task 7: Verify Runtime Behavior and Required Viewports

**Files:**
- Modify only if verification reveals a defect: `web/index.html`, `web/styles.css`, `web/app.js`, `tests/frontend-redesign.test.js`
- Do not modify: `Dockerfile`, `Dockerfile.app`, `docker-compose.yml`, `docker-compose.prebuilt.yml`, `src/runner/**`

- [ ] **Step 1: Run the complete automated suite from a clean process**

Run:

```powershell
npm test
```

Expected: every test passes.

- [ ] **Step 2: Verify Docker and runner files are unchanged**

Run:

```powershell
git diff v2.2 -- Dockerfile Dockerfile.app docker-compose.yml docker-compose.prebuilt.yml src/runner
```

Expected: no diff.

- [ ] **Step 3: Start the feature worktree server on an unused port**

Run with a hidden process and explicit port:

```powershell
$env:PORT = "43118"
npm.cmd start
```

Expected log: `ACMCoder is running at http://127.0.0.1:43118`.

- [ ] **Step 4: Verify API and static page health**

Run:

```powershell
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:43118/api/problems
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:43118/
```

Expected: both return HTTP 200 and the root contains `id="view-today"`.

- [ ] **Step 5: Capture and inspect required browser screenshots**

Use Playwright or the in-app browser to capture:

```text
artifacts/frontend-redesign/desktop-today-1440x900.png
artifacts/frontend-redesign/desktop-practice-1440x900.png
artifacts/frontend-redesign/tablet-1024x768.png
artifacts/frontend-redesign/mobile-today-390x844.png
artifacts/frontend-redesign/mobile-practice-390x844.png
```

At each viewport verify: no overlap, no horizontal scroll, readable glass controls, visible active navigation, correct editor line-number alignment, and visible result console after a run.

- [ ] **Step 6: Exercise the end-to-end daily flow**

In the browser:

1. Confirm Today is the initial view.
2. Import a three-entry recommendation JSON if the catalog is empty.
3. Generate a plan and verify source text is `AI 推荐` or `本地规则` according to the response.
4. Open one source link and verify the app remains on Today.
5. Choose `Add and practice`, verify `memory:<slug>` is selected, and verify Practice opens.
6. Run a deterministic sample and verify the result tab opens.
7. When the result is AC, verify today's completed count updates from `lastAcceptedAt`.
8. Open My Library, batch controls, Catalog, and Settings and verify each view remains functional.

- [ ] **Step 7: Re-run full tests after visual fixes**

Run:

```powershell
npm test
git diff --check
git status -sb
```

Expected: full suite PASS, no whitespace errors, only intended files changed, and `.superpowers/` remains untracked or locally ignored rather than committed.

- [ ] **Step 8: Commit any verification fixes**

If verification required changes:

```powershell
git add web/index.html web/styles.css web/app.js web/icons.js web/view-state.js tests/frontend-redesign.test.js tests/web-copy.test.js
git commit -m "fix: polish responsive frontend workflow"
```

If no fixes were required, do not create an empty commit.

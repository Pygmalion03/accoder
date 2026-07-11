import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

import {
  APP_VIEWS,
  UTILITY_TABS,
  canonicalProblemSlug,
  dailyPlanProgress,
  nextCatalogSelection,
  normalizeUtilityTab,
  normalizeView,
} from "../web/view-state.js";
import { iconMarkup } from "../web/icons.js";

test("defines and normalizes application views and utility tabs", () => {
  assert.deepEqual(APP_VIEWS, ["today", "practice", "library", "catalog", "settings"]);
  assert.deepEqual(UTILITY_TABS, ["test", "result", "assist"]);
  assert.equal(normalizeView("catalog"), "catalog");
  assert.equal(normalizeView("unknown"), "today");
  assert.equal(normalizeUtilityTab("assist"), "assist");
  assert.equal(normalizeUtilityTab("unknown"), "test");
});

test("canonicalizes problem slugs and prefers LeetCode metadata", () => {
  assert.equal(
    canonicalProblemSlug({ slug: "memory:lru-cache", leetcode: { slug: "memory:two-sum" } }),
    "two-sum",
  );
  assert.equal(canonicalProblemSlug({ slug: "memory:lru-cache" }), "lru-cache");
  assert.equal(canonicalProblemSlug(null), "");
});

test("calculates accepted progress for the plan date", () => {
  const plan = {
    date: "2026-07-10",
    items: [
      { leetcodeSlug: "two-sum" },
      { leetcodeSlug: "lru-cache" },
      { leetcodeSlug: "merge-k-sorted-lists" },
    ],
  };
  const problems = [
    {
      slug: "memory:two-sum",
      progress: { lastAcceptedAt: "2026-07-10T08:30:00+08:00" },
    },
    {
      slug: "memory:lru-cache",
      progress: { lastAcceptedAt: "2026-07-09T22:00:00+08:00" },
    },
  ];

  assert.deepEqual(dailyPlanProgress(plan, problems), { completed: 1, total: 3, percent: 33 });
  assert.deepEqual(dailyPlanProgress(null), { completed: 0, total: 0, percent: 0 });
});

test("toggles select all for recommendation catalog entries", () => {
  const catalog = [{ leetcodeSlug: "two-sum" }, { leetcodeSlug: "lru-cache" }];

  assert.deepEqual(nextCatalogSelection(catalog, new Set()), ["two-sum", "lru-cache"]);
  assert.deepEqual(nextCatalogSelection(catalog, new Set(["two-sum"])), ["two-sum", "lru-cache"]);
  assert.deepEqual(nextCatalogSelection(catalog, new Set(["two-sum", "lru-cache"])), []);
  assert.deepEqual(nextCatalogSelection([], new Set()), []);
});

test("web UI has no runtime CDN or font URL dependencies", () => {
  const html = fs.readFileSync("web/index.html", "utf8");

  assert.doesNotMatch(html, /https?:\/\/(?:unpkg|cdn|fonts\.)/i);
});

test("web UI exposes the semantic application shell and every view target", () => {
  const html = fs.readFileSync("web/index.html", "utf8");

  assert.match(html, /id="app-navigation"/);
  assert.match(html, /data-nav-group="smart-practice"/);
  assert.match(html, /data-nav-group="workspace"/);
  assert.match(html, /data-nav-group="system"/);
  assert.match(html, /aria-live="polite"/);

  for (const view of APP_VIEWS) {
    assert.match(html, new RegExp(`id="view-${view}"`));
    assert.match(html, new RegExp(`data-view-target="${view}"`));
  }
});

test("web UI preserves each behavior-bearing element ID exactly once", () => {
  const html = fs.readFileSync("web/index.html", "utf8");
  const ids = [
    "search",
    "problem-list",
    "select-problems",
    "delete-problems",
    "export-problems",
    "import-problems",
    "import-file",
    "problem-title",
    "eyebrow",
    "leetcode-link",
    "problem-description",
    "language",
    "runner",
    "runner-health",
    "load-template",
    "run",
    "code-editor",
    "line-numbers",
    "code-highlight",
    "code",
    "stdin",
    "expected",
    "sample-io",
    "clear-expected",
    "status",
    "message",
    "stdout",
    "stderr",
    "assist-key",
    "assist-base-url",
    "assist-model",
    "save-assist-settings",
    "assist-question",
    "ask-assist",
    "assist-answer",
    "daily-count",
    "daily-difficulty",
    "daily-tags",
    "generate-daily",
    "import-catalog",
    "catalog-file",
    "daily-status",
    "daily-list",
    "catalog-import",
    "catalog-export",
    "catalog-select",
    "catalog-select-all",
    "catalog-delete",
    "catalog-status",
    "catalog-list",
  ];

  for (const id of ids) {
    assert.equal(html.match(new RegExp(`id="${id}"`, "g"))?.length, 1, id);
  }
});

test("local icon markup exposes the required Lucide icons", () => {
  const iconNames = [
    "home",
    "sparkles",
    "code-2",
    "library-big",
    "settings",
    "search",
    "external-link",
    "play",
    "upload",
    "download",
    "trash-2",
  ];

  for (const name of iconNames) {
    assert.match(iconMarkup(name), /^<svg\b/, name);
  }
  assert.equal(iconMarkup("missing"), "");
});

test("web app wires the five-view workspace and utility tabs", () => {
  const script = fs.readFileSync("web/app.js", "utf8");

  assert.match(script, /import \{ hydrateIcons, iconMarkup \} from "\.\/icons\.js"/);
  assert.match(script, /import \{[\s\S]*normalizeUtilityTab[\s\S]*normalizeView[\s\S]*\} from "\.\/view-state\.js"/);
  assert.match(script, /activeView:\s*"today"/);
  assert.match(script, /activeUtilityTab:\s*"test"/);
  assert.match(script, /function setActiveView\(/);
  assert.match(script, /function setUtilityTab\(/);
  assert.match(script, /function setMobileMoreOpen\(/);
  assert.match(script, /function updateLibraryCount\(/);
});

test("web app keeps catalog and settings actions connected to existing local flows", () => {
  const html = fs.readFileSync("web/index.html", "utf8");
  const script = fs.readFileSync("web/app.js", "utf8");

  assert.match(script, /settingsImportProblems/);
  assert.match(script, /settingsExportProblems/);
  assert.match(script, /catalogImport/);
  assert.match(script, /globalSearch/);
  assert.match(script, /api\/recommendation\/catalog/);
  assert.match(script, /function updateCatalogActions\(/);
  assert.match(script, /function toggleCatalogSelectAll\(/);
  assert.match(script, /async function exportRecommendationCatalog\(/);
  assert.match(script, /async function deleteSelectedCatalogEntries\(/);
  assert.match(script, /nextCatalogSelection/);
  assert.match(html, /placeholder="数组、动态规划、图"/);
  assert.doesNotMatch(html, /只读高频题池/);
  assert.match(script, /reloadProblems\(\{ preserveView = false \} = \{\}\)/);
});

test("today view reports accepted progress and opens recommendations in practice", () => {
  const script = fs.readFileSync("web/app.js", "utf8");

  assert.match(script, /dailyPlanProgress/);
  assert.match(script, /function renderDailyProgress\(/);
  assert.match(script, /function openPracticeForRecommendation\(/);
  assert.match(script, /打开原题/);
  assert.match(script, /加入并练习/);
  assert.match(script, /memory:\$\{slug\}/);
  assert.match(script, /const apiAction = action === "practice" \? "add_to_practice" : action/);
  assert.match(script, /body: JSON\.stringify\(\{ action: apiAction \}\)/);
  assert.match(script, /setActiveView\("practice"\)/);
});

test("practice view exposes session context, result switching, and mobile panels", () => {
  const script = fs.readFileSync("web/app.js", "utf8");

  assert.match(script, /function renderDailySession\(/);
  assert.match(script, /function setMobilePracticeTab\(/);
  assert.match(script, /function setProblemInspectorOpen\(/);
  assert.match(script, /setUtilityTab\("result"\)/);
  assert.match(script, /data-mobile-practice-tab/);
});

test("visual system uses restrained glass surfaces and an opaque coding workspace", () => {
  const css = fs.readFileSync("web/styles.css", "utf8");

  assert.match(css, /--page-backing:\s*#cbd9d4/);
  assert.match(css, /--glass-surface:\s*rgba\(245,\s*249,\s*247,\s*\.68\)/);
  assert.match(css, /--editor:\s*#0d1113/);
  assert.match(css, /\.app-nav\s*\{[\s\S]*backdrop-filter:\s*blur\(/);
  assert.match(css, /\.editor-pane\s*\{[\s\S]*background:\s*var\(--editor\)/);
  assert.match(css, /@supports not \(backdrop-filter:/);
  assert.doesNotMatch(css, /(?:linear|radial)-gradient\(/);
});

test("visual system provides compact tablet and mobile navigation layouts", () => {
  const css = fs.readFileSync("web/styles.css", "utf8");

  assert.match(css, /@media \(max-width:\s*1179px\)/);
  assert.match(css, /@media \(max-width:\s*759px\)/);
  assert.match(css, /\.catalog-view \.view-heading\s*\{\s*flex-direction: column;/);
  assert.match(css, /\.mobile-nav/);
  assert.match(css, /\.mobile-practice-tabs/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
});

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

  assert.match(script, /import \{ hydrateIcons \} from "\.\/icons\.js"/);
  assert.match(script, /import \{[\s\S]*normalizeUtilityTab[\s\S]*normalizeView[\s\S]*\} from "\.\/view-state\.js"/);
  assert.match(script, /activeView:\s*"today"/);
  assert.match(script, /activeUtilityTab:\s*"test"/);
  assert.match(script, /function setActiveView\(/);
  assert.match(script, /function setUtilityTab\(/);
  assert.match(script, /function setMobileMoreOpen\(/);
  assert.match(script, /function updateLibraryCount\(/);
});

test("web app keeps catalog and settings actions connected to existing local flows", () => {
  const script = fs.readFileSync("web/app.js", "utf8");

  assert.match(script, /settingsImportProblems/);
  assert.match(script, /settingsExportProblems/);
  assert.match(script, /catalogImport/);
  assert.match(script, /globalSearch/);
  assert.match(script, /api\/recommendation\/catalog/);
  assert.match(script, /reloadProblems\(\{ preserveView = false \} = \{\}\)/);
});

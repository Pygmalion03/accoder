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

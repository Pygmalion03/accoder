import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  createFallbackPlan,
  generateDailyPlan,
  loadDailyPlan,
  updateDailyPlanItemAction,
  validateAiPlan,
} from "../src/server/daily-plan.js";

const candidates = [
  {
    leetcodeSlug: "two-sum",
    title: "Two Sum",
    leetcodeUrl: "https://leetcode.cn/problems/two-sum/",
    difficulty: "easy",
    tags: ["array", "hash-table"],
    score: 100,
  },
  {
    leetcodeSlug: "lru-cache",
    title: "LRU Cache",
    leetcodeUrl: "https://leetcode.cn/problems/lru-cache/",
    difficulty: "medium",
    tags: ["hash-table", "linked-list"],
    score: 90,
  },
  {
    leetcodeSlug: "merge-k-sorted-lists",
    title: "Merge k Sorted Lists",
    leetcodeUrl: "https://leetcode.cn/problems/merge-k-sorted-lists/",
    difficulty: "hard",
    tags: ["linked-list", "heap"],
    score: 80,
  },
];

test("validates an AI plan against allowed candidate slugs", () => {
  const plan = validateAiPlan(
    {
      theme: "Hash table and linked list practice",
      items: [
        {
          leetcodeSlug: "two-sum",
          focus: "hash-table",
          reason: "Warm up with a high-frequency array problem.",
          estimatedMinutes: 15,
        },
        {
          leetcodeSlug: "lru-cache",
          focus: "linked-list",
          reason: "Practice linked list plus hash table design.",
          estimatedMinutes: 30,
        },
      ],
    },
    candidates,
    "2026-07-09",
    2,
  );

  assert.equal(plan.source, "ai");
  assert.equal(plan.date, "2026-07-09");
  assert.equal(plan.items.length, 2);
  assert.equal(plan.items[0].title, "Two Sum");
  assert.equal(plan.items[0].actions.opened, false);
  assert.equal(plan.difficultyMix.easy, 1);
  assert.equal(plan.difficultyMix.medium, 1);
});

test("rejects AI plans with unknown or duplicate slugs", () => {
  assert.throws(
    () => validateAiPlan({ theme: "bad", items: [{ leetcodeSlug: "unknown" }] }, candidates, "2026-07-09", 1),
    /unknown candidate/,
  );

  assert.throws(
    () =>
      validateAiPlan(
        { theme: "bad", items: [{ leetcodeSlug: "two-sum" }, { leetcodeSlug: "two-sum" }] },
        candidates,
        "2026-07-09",
        2,
      ),
    /duplicate candidate/,
  );
});

test("rejects AI plans that return fewer items than requested", () => {
  assert.throws(
    () => validateAiPlan({ theme: "too short", items: [{ leetcodeSlug: "two-sum" }] }, candidates, "2026-07-09", 2),
    /unexpected item count/,
  );
});

test("creates a deterministic fallback plan from ranked candidates", () => {
  const plan = createFallbackPlan({ candidates, date: "2026-07-09", count: 2 });

  assert.equal(plan.source, "fallback");
  assert.equal(plan.theme, "高频面试题训练");
  assert.equal(plan.items[0].reason, "根据题目频率和个人练习记录排序。");
  assert.equal(plan.items.length, 2);
  assert.deepEqual(
    plan.items.map((item) => item.leetcodeSlug),
    ["two-sum", "lru-cache"],
  );
});

test("generates and stores an AI plan when the model returns valid JSON", async () => {
  const planFile = path.join(await fs.mkdtemp(path.join(os.tmpdir(), "acmcoder-plan-")), "daily-plans.json");
  const calls = [];

  const plan = await generateDailyPlan({
    candidates,
    date: "2026-07-09",
    count: 2,
    planFile,
    settings: {
      apiKey: "sk-local-test",
      baseUrl: "https://llm.example.test/v1",
      model: "planner-model",
    },
    fetch: async (url, options) => {
      calls.push({ url, options });
      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  theme: "Hash table practice",
                  items: [
                    { leetcodeSlug: "two-sum", reason: "Core high-frequency warmup.", focus: "hash-table", estimatedMinutes: 15 },
                    { leetcodeSlug: "lru-cache", reason: "Design problem with linked list.", focus: "design", estimatedMinutes: 30 },
                  ],
                }),
              },
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    },
  });

  assert.equal(plan.source, "ai");
  assert.equal(calls.length, 1);
  const requestBody = JSON.parse(calls[0].options.body);
  assert.match(requestBody.messages[0].content, /使用中文/);
  const stored = await loadDailyPlan("2026-07-09", planFile);
  assert.equal(stored.theme, "Hash table practice");
});

test("falls back and stores a fallback plan when AI is unavailable", async () => {
  const planFile = path.join(await fs.mkdtemp(path.join(os.tmpdir(), "acmcoder-plan-")), "daily-plans.json");

  const plan = await generateDailyPlan({
    candidates,
    date: "2026-07-09",
    count: 2,
    planFile,
    settings: { apiKey: "", baseUrl: "https://llm.example.test/v1", model: "planner-model" },
    fetch: async () => {
      throw new Error("fetch should not be called without api key");
    },
  });

  assert.equal(plan.source, "fallback");
  const stored = await loadDailyPlan("2026-07-09", planFile);
  assert.equal(stored.source, "fallback");
});

test("falls back when AI returns invalid JSON or unknown candidates", async () => {
  const planFile = path.join(await fs.mkdtemp(path.join(os.tmpdir(), "acmcoder-plan-")), "daily-plans.json");
  const plan = await generateDailyPlan({
    candidates,
    date: "2026-07-09",
    count: 2,
    planFile,
    settings: { apiKey: "sk-local-test", baseUrl: "https://llm.example.test/v1", model: "planner-model" },
    fetch: async () =>
      new Response(
        JSON.stringify({
          choices: [{ message: { content: JSON.stringify({ theme: "bad", items: [{ leetcodeSlug: "missing" }] }) } }],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
  });

  assert.equal(plan.source, "fallback");
  assert.deepEqual(
    plan.items.map((item) => item.leetcodeSlug),
    ["two-sum", "lru-cache"],
  );
});

test("falls back when AI returns a valid candidate list with the wrong item count", async () => {
  const planFile = path.join(await fs.mkdtemp(path.join(os.tmpdir(), "acmcoder-plan-count-")), "daily-plans.json");
  const plan = await generateDailyPlan({
    candidates,
    date: "2026-07-09",
    count: 2,
    planFile,
    settings: { apiKey: "sk-local-test", baseUrl: "https://llm.example.test/v1", model: "planner-model" },
    fetch: async () =>
      new Response(
        JSON.stringify({
          choices: [{ message: { content: JSON.stringify({ theme: "short", items: [{ leetcodeSlug: "two-sum" }] }) } }],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
  });

  assert.equal(plan.source, "fallback");
  assert.deepEqual(
    plan.items.map((item) => item.leetcodeSlug),
    ["two-sum", "lru-cache"],
  );
});

test("aborts a slow AI request and falls back within the configured deadline", async () => {
  const planFile = path.join(await fs.mkdtemp(path.join(os.tmpdir(), "acmcoder-plan-timeout-")), "daily-plans.json");
  let receivedSignal;

  const plan = await generateDailyPlan({
    candidates,
    date: "2026-07-09",
    count: 2,
    planFile,
    modelTimeoutMs: 10,
    settings: { apiKey: "sk-local-test", baseUrl: "https://llm.example.test/v1", model: "planner-model" },
    fetch: async (_url, options) =>
      new Promise((_resolve, reject) => {
        receivedSignal = options.signal;
        if (!receivedSignal) {
          reject(new Error("missing abort signal"));
          return;
        }
        receivedSignal.addEventListener("abort", () => reject(receivedSignal.reason), { once: true });
      }),
  });

  assert.ok(receivedSignal);
  assert.equal(receivedSignal.aborted, true);
  assert.equal(plan.source, "fallback");
});

test("updates item actions inside a stored daily plan", async () => {
  const planFile = path.join(await fs.mkdtemp(path.join(os.tmpdir(), "acmcoder-plan-")), "daily-plans.json");
  await generateDailyPlan({
    candidates,
    date: "2026-07-09",
    count: 2,
    planFile,
    settings: { apiKey: "", baseUrl: "https://llm.example.test/v1", model: "planner-model" },
  });

  const plan = await updateDailyPlanItemAction({
    planFile,
    date: "2026-07-09",
    slug: "two-sum",
    action: "open",
  });

  assert.equal(plan.items.find((item) => item.leetcodeSlug === "two-sum").actions.opened, true);
});

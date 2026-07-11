import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { createAcmcoderServer } from "../src/server/server.js";

function listen(server) {
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve(server.address().port));
  });
}

function tempFile(dir, name) {
  return path.join(dir, name);
}

const twoSumRecommendation = {
  leetcodeSlug: "two-sum",
  title: "Two Sum",
  leetcodeUrl: "https://leetcode.cn/problems/two-sum/",
  difficulty: "easy",
  tags: ["array"],
  frequencyScore: 1,
};

function completeTwoSumPage(capturedAt = "2026-07-11T04:00:00.000Z") {
  return {
    source: "leetcode",
    url: twoSumRecommendation.leetcodeUrl,
    slug: "two-sum",
    frontendId: "1",
    title: "两数之和",
    difficulty: "easy",
    tags: ["数组", "哈希表"],
    sample: { inputText: "nums = [2,7], target = 9", outputText: "[0,1]" },
    content: "给你一个整数数组 nums 和一个整数目标值 target，请找出和为目标值的两个整数。",
    capturedAt,
  };
}

async function seedTwoSumPlan(port) {
  await fetch(`http://127.0.0.1:${port}/api/recommendation/import`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      format: "acmcoder-recommendation-catalog-v1",
      entries: [twoSumRecommendation],
    }),
  });
  await fetch(`http://127.0.0.1:${port}/api/daily-plan/generate`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ date: "2026-07-09", count: 1 }),
  });
}

async function addTwoSumToPractice(port) {
  return fetch(`http://127.0.0.1:${port}/api/daily-plan/items/two-sum/action`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ date: "2026-07-09", action: "add_to_practice" }),
  });
}

async function saveMemoryPage(port, page) {
  return fetch(`http://127.0.0.1:${port}/api/memory/pages`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(page),
  });
}

test("imports recommendation catalog and lists catalog entries", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "acmcoder-daily-api-"));
  const server = createAcmcoderServer({
    recommendationCatalogFile: tempFile(tempDir, "catalog.json"),
    plannerProfileFile: tempFile(tempDir, "planner-profile.json"),
    dailyPlanFile: tempFile(tempDir, "daily-plans.json"),
  });
  const port = await listen(server);

  try {
    const importResponse = await fetch(`http://127.0.0.1:${port}/api/recommendation/import`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        format: "acmcoder-recommendation-catalog-v1",
        entries: [
          {
            leetcodeSlug: "two-sum",
            title: "Two Sum",
            leetcodeUrl: "https://leetcode.cn/problems/two-sum/",
            difficulty: "easy",
            tags: ["array"],
            frequencyScore: 1,
          },
        ],
      }),
    });
    const importBody = await importResponse.json();

    assert.equal(importResponse.status, 200);
    assert.equal(importBody.importedCount, 1);

    const listResponse = await fetch(`http://127.0.0.1:${port}/api/recommendation/catalog`);
    const listBody = await listResponse.json();

    assert.equal(listResponse.status, 200);
    assert.equal(listBody.catalog.entries[0].leetcodeSlug, "two-sum");
  } finally {
    server.close();
  }
});

test("exports and batch deletes recommendation catalog entries", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "acmcoder-daily-api-"));
  const server = createAcmcoderServer({
    recommendationCatalogFile: tempFile(tempDir, "catalog.json"),
    plannerProfileFile: tempFile(tempDir, "planner-profile.json"),
    dailyPlanFile: tempFile(tempDir, "daily-plans.json"),
  });
  const port = await listen(server);

  try {
    await fetch(`http://127.0.0.1:${port}/api/recommendation/import`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        format: "acmcoder-recommendation-catalog-v1",
        entries: [
          twoSumRecommendation,
          {
            leetcodeSlug: "lru-cache",
            title: "LRU 缓存",
            leetcodeUrl: "https://leetcode.cn/problems/lru-cache/",
            difficulty: "medium",
            tags: ["哈希表", "链表"],
            frequencyScore: 0.9,
          },
        ],
      }),
    });

    const exportResponse = await fetch(
      `http://127.0.0.1:${port}/api/recommendation/export?slugs=lru-cache`,
    );
    const exportBody = await exportResponse.json();
    assert.equal(exportResponse.status, 200);
    assert.match(exportResponse.headers.get("content-disposition") || "", /attachment/);
    assert.equal(exportBody.format, "acmcoder-recommendation-catalog-v1");
    assert.deepEqual(exportBody.entries.map((entry) => entry.leetcodeSlug), ["lru-cache"]);

    const deleteResponse = await fetch(`http://127.0.0.1:${port}/api/recommendation/catalog`, {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ slugs: ["lru-cache"] }),
    });
    const deleteBody = await deleteResponse.json();
    assert.equal(deleteResponse.status, 200);
    assert.deepEqual(deleteBody.deletedSlugs, ["lru-cache"]);
    assert.deepEqual(deleteBody.catalog.entries.map((entry) => entry.leetcodeSlug), ["two-sum"]);
  } finally {
    server.close();
  }
});

test("generates today daily plan through the local API with fallback when no model key exists", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "acmcoder-daily-api-"));
  const server = createAcmcoderServer({
    recommendationCatalogFile: tempFile(tempDir, "catalog.json"),
    plannerProfileFile: tempFile(tempDir, "planner-profile.json"),
    dailyPlanFile: tempFile(tempDir, "daily-plans.json"),
    progressFile: tempFile(tempDir, "progress.json"),
    assistSettingsFile: tempFile(tempDir, "settings.json"),
  });
  const port = await listen(server);

  try {
    await fetch(`http://127.0.0.1:${port}/api/recommendation/import`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        format: "acmcoder-recommendation-catalog-v1",
        entries: [
          {
            leetcodeSlug: "two-sum",
            title: "Two Sum",
            leetcodeUrl: "https://leetcode.cn/problems/two-sum/",
            difficulty: "easy",
            tags: ["array"],
            frequencyScore: 1,
          },
          {
            leetcodeSlug: "lru-cache",
            title: "LRU Cache",
            leetcodeUrl: "https://leetcode.cn/problems/lru-cache/",
            difficulty: "medium",
            tags: ["hash-table", "linked-list"],
            frequencyScore: 0.9,
          },
        ],
      }),
    });

    const generateResponse = await fetch(`http://127.0.0.1:${port}/api/daily-plan/generate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ date: "2026-07-09", count: 2 }),
    });
    const generateBody = await generateResponse.json();

    assert.equal(generateResponse.status, 200);
    assert.equal(generateBody.plan.source, "fallback");
    assert.equal(generateBody.plan.items.length, 2);

    const todayResponse = await fetch(`http://127.0.0.1:${port}/api/daily-plan/today?date=2026-07-09`);
    const todayBody = await todayResponse.json();
    assert.equal(todayBody.plan.items[0].leetcodeSlug, "two-sum");
  } finally {
    server.close();
  }
});

test("records daily plan item actions and adds a recommendation to practice memory", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "acmcoder-daily-api-"));
  const server = createAcmcoderServer({
    recommendationCatalogFile: tempFile(tempDir, "catalog.json"),
    plannerProfileFile: tempFile(tempDir, "planner-profile.json"),
    dailyPlanFile: tempFile(tempDir, "daily-plans.json"),
    progressFile: tempFile(tempDir, "progress.json"),
    memoryFile: tempFile(tempDir, "pages.jsonl"),
    currentMemoryFile: tempFile(tempDir, "current.json"),
    assistSettingsFile: tempFile(tempDir, "settings.json"),
    fetchLeetCodePage: async () => completeTwoSumPage(),
  });
  const port = await listen(server);

  try {
    await seedTwoSumPlan(port);
    const actionResponse = await addTwoSumToPractice(port);
    const actionBody = await actionResponse.json();

    assert.equal(actionResponse.status, 200);
    assert.equal(actionBody.plan.items[0].actions.addedToPractice, true);

    const memoryResponse = await fetch(`http://127.0.0.1:${port}/api/memory/pages?slug=two-sum`);
    const memoryBody = await memoryResponse.json();
    assert.equal(memoryBody.pages.length, 1);
    assert.equal(memoryBody.pages[0].title, "两数之和");
    assert.match(memoryBody.pages[0].content, /整数数组 nums/);
    assert.doesNotMatch(memoryBody.pages[0].content, /Open the LeetCode link/);
  } finally {
    server.close();
  }
});

test("reuses a complete locally captured statement without requesting LeetCode", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "acmcoder-daily-api-"));
  let fetchCount = 0;
  const server = createAcmcoderServer({
    recommendationCatalogFile: tempFile(tempDir, "catalog.json"),
    plannerProfileFile: tempFile(tempDir, "planner-profile.json"),
    dailyPlanFile: tempFile(tempDir, "daily-plans.json"),
    progressFile: tempFile(tempDir, "progress.json"),
    memoryFile: tempFile(tempDir, "pages.jsonl"),
    currentMemoryFile: tempFile(tempDir, "current.json"),
    assistSettingsFile: tempFile(tempDir, "settings.json"),
    fetchLeetCodePage: async () => {
      fetchCount += 1;
      return completeTwoSumPage();
    },
  });
  const port = await listen(server);

  try {
    await seedTwoSumPlan(port);
    await saveMemoryPage(port, completeTwoSumPage("2026-07-10T04:00:00.000Z"));

    const actionResponse = await addTwoSumToPractice(port);
    assert.equal(actionResponse.status, 200);
    assert.equal(fetchCount, 0);

    const memoryBody = await (await fetch(`http://127.0.0.1:${port}/api/memory/pages?slug=two-sum`)).json();
    assert.equal(memoryBody.pages.length, 1);
    assert.match(memoryBody.pages[0].content, /整数数组 nums/);
  } finally {
    server.close();
  }
});

test("repairs an old metadata-only practice record with a complete statement", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "acmcoder-daily-api-"));
  let fetchCount = 0;
  const server = createAcmcoderServer({
    recommendationCatalogFile: tempFile(tempDir, "catalog.json"),
    plannerProfileFile: tempFile(tempDir, "planner-profile.json"),
    dailyPlanFile: tempFile(tempDir, "daily-plans.json"),
    progressFile: tempFile(tempDir, "progress.json"),
    memoryFile: tempFile(tempDir, "pages.jsonl"),
    currentMemoryFile: tempFile(tempDir, "current.json"),
    assistSettingsFile: tempFile(tempDir, "settings.json"),
    fetchLeetCodePage: async () => {
      fetchCount += 1;
      return completeTwoSumPage();
    },
  });
  const port = await listen(server);

  try {
    await seedTwoSumPlan(port);
    await saveMemoryPage(port, {
      ...completeTwoSumPage("2026-07-10T04:00:00.000Z"),
      title: "Two Sum",
      sample: null,
      content: "Open the LeetCode link for the full statement. ACMCoder stores only recommendation metadata for Two Sum.",
    });

    const actionResponse = await addTwoSumToPractice(port);
    assert.equal(actionResponse.status, 200);
    assert.equal(fetchCount, 1);

    const memoryBody = await (await fetch(`http://127.0.0.1:${port}/api/memory/pages?slug=two-sum`)).json();
    assert.equal(memoryBody.pages.length, 2);
    assert.match(memoryBody.pages.at(-1).content, /整数数组 nums/);
  } finally {
    server.close();
  }
});

test("does not add a recommendation when its complete statement cannot be resolved", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "acmcoder-daily-api-"));
  const server = createAcmcoderServer({
    recommendationCatalogFile: tempFile(tempDir, "catalog.json"),
    plannerProfileFile: tempFile(tempDir, "planner-profile.json"),
    dailyPlanFile: tempFile(tempDir, "daily-plans.json"),
    progressFile: tempFile(tempDir, "progress.json"),
    memoryFile: tempFile(tempDir, "pages.jsonl"),
    currentMemoryFile: tempFile(tempDir, "current.json"),
    assistSettingsFile: tempFile(tempDir, "settings.json"),
    fetchLeetCodePage: async () => {
      throw new Error("LeetCode 题面请求失败（403）。");
    },
  });
  const port = await listen(server);

  try {
    await seedTwoSumPlan(port);
    const actionResponse = await addTwoSumToPractice(port);
    const actionBody = await actionResponse.json();

    assert.equal(actionResponse.status, 400);
    assert.match(actionBody.error, /题面请求失败/);

    const memoryBody = await (await fetch(`http://127.0.0.1:${port}/api/memory/pages?slug=two-sum`)).json();
    assert.equal(memoryBody.pages.length, 0);

    const planBody = await (await fetch(`http://127.0.0.1:${port}/api/daily-plan/today?date=2026-07-09`)).json();
    assert.equal(planBody.plan.items[0].actions.addedToPractice, false);
  } finally {
    server.close();
  }
});

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
        ],
      }),
    });
    await fetch(`http://127.0.0.1:${port}/api/daily-plan/generate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ date: "2026-07-09", count: 1 }),
    });

    const actionResponse = await fetch(`http://127.0.0.1:${port}/api/daily-plan/items/two-sum/action`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ date: "2026-07-09", action: "add_to_practice" }),
    });
    const actionBody = await actionResponse.json();

    assert.equal(actionResponse.status, 200);
    assert.equal(actionBody.plan.items[0].actions.addedToPractice, true);

    const memoryResponse = await fetch(`http://127.0.0.1:${port}/api/memory/pages?slug=two-sum`);
    const memoryBody = await memoryResponse.json();
    assert.equal(memoryBody.pages.length, 1);
    assert.equal(memoryBody.pages[0].title, "Two Sum");
    assert.match(memoryBody.pages[0].content, /Open the LeetCode link/);
  } finally {
    server.close();
  }
});

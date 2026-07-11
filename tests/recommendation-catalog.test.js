import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  deleteRecommendationCatalogEntries,
  exportRecommendationCatalog,
  importRecommendationCatalog,
  loadRecommendationCatalog,
} from "../src/server/recommendation-catalog.js";

test("imports CodeTop-style recommendation entries into a local catalog", async () => {
  const catalogFile = path.join(
    await fs.mkdtemp(path.join(os.tmpdir(), "acmcoder-catalog-")),
    "catalog.json",
  );

  const result = await importRecommendationCatalog(
    {
      format: "acmcoder-recommendation-catalog-v1",
      source: "codetop",
      entries: [
        {
          sourceRank: 2,
          leetcodeSlug: "reverse-linked-list",
          title: "Reverse Linked List",
          leetcodeUrl: "https://leetcode.cn/problems/reverse-linked-list/",
          difficulty: "Easy",
          tags: ["linked-list", "recursion", "linked-list"],
          frequencyScore: 0.97,
        },
      ],
    },
    catalogFile,
    "2026-07-09T10:00:00.000Z",
  );

  assert.equal(result.importedCount, 1);
  assert.equal(result.catalog.entries[0].source, "codetop");
  assert.equal(result.catalog.entries[0].sourceRank, 2);
  assert.equal(result.catalog.entries[0].leetcodeSlug, "reverse-linked-list");
  assert.equal(result.catalog.entries[0].difficulty, "easy");
  assert.deepEqual(result.catalog.entries[0].tags, ["linked-list", "recursion"]);
  assert.equal(result.catalog.entries[0].lastSyncedAt, "2026-07-09T10:00:00.000Z");

  const loaded = await loadRecommendationCatalog(catalogFile);
  assert.equal(loaded.entries.length, 1);
  assert.equal(loaded.entries[0].leetcodeUrl, "https://leetcode.cn/problems/reverse-linked-list/");
});

test("rejects recommendation entries without slug or LeetCode URL", async () => {
  const catalogFile = path.join(
    await fs.mkdtemp(path.join(os.tmpdir(), "acmcoder-catalog-")),
    "catalog.json",
  );

  await assert.rejects(
    () =>
      importRecommendationCatalog(
        {
          format: "acmcoder-recommendation-catalog-v1",
          entries: [{ title: "Broken" }],
        },
        catalogFile,
      ),
    /Missing recommendation slug/,
  );

  await assert.rejects(
    () =>
      importRecommendationCatalog(
        {
          format: "acmcoder-recommendation-catalog-v1",
          entries: [{ leetcodeSlug: "two-sum", title: "Two Sum" }],
        },
        catalogFile,
      ),
    /Missing LeetCode URL for recommendation: two-sum/,
  );
});

test("returns an empty catalog when the catalog file does not exist", async () => {
  const catalogFile = path.join(
    await fs.mkdtemp(path.join(os.tmpdir(), "acmcoder-catalog-")),
    "missing.json",
  );
  const catalog = await loadRecommendationCatalog(catalogFile);

  assert.equal(catalog.version, 1);
  assert.deepEqual(catalog.entries, []);
});

test("rejects unsupported recommendation payloads without overwriting the catalog", async () => {
  const catalogFile = path.join(
    await fs.mkdtemp(path.join(os.tmpdir(), "acmcoder-catalog-")),
    "catalog.json",
  );
  const existingCatalogText = JSON.stringify(
    {
      version: 1,
      importedAt: "2026-07-09T09:00:00.000Z",
      entries: [
        {
          source: "codetop",
          sourceRank: 1,
          leetcodeSlug: "existing-problem",
          title: "Existing Problem",
          leetcodeUrl: "https://leetcode.cn/problems/existing-problem/",
          difficulty: "easy",
          tags: [],
          frequencyScore: 0.8,
          lastSyncedAt: "2026-07-09T09:00:00.000Z",
        },
      ],
    },
    null,
    2,
  );
  await fs.writeFile(catalogFile, existingCatalogText, "utf8");

  for (const payload of [null, { items: [{ leetcodeSlug: "two-sum" }] }, { source: "codetop" }]) {
    await assert.rejects(
      () => importRecommendationCatalog(payload, catalogFile),
      /Recommendation catalog import requires an entries array\./,
    );
    assert.equal(await fs.readFile(catalogFile, "utf8"), existingCatalogText);
  }
});

test("sorts unknown source ranks after known ranks when frequency ties", async () => {
  const catalogFile = path.join(
    await fs.mkdtemp(path.join(os.tmpdir(), "acmcoder-catalog-")),
    "catalog.json",
  );

  const result = await importRecommendationCatalog(
    {
      source: "codetop",
      entries: [
        {
          sourceRank: "not-a-number",
          leetcodeSlug: "bad-rank",
          leetcodeUrl: "https://leetcode.cn/problems/bad-rank/",
          frequencyScore: 0.5,
        },
        {
          leetcodeSlug: "missing-rank",
          leetcodeUrl: "https://leetcode.cn/problems/missing-rank/",
          frequencyScore: 0.5,
        },
        {
          sourceRank: 1,
          leetcodeSlug: "rank-one",
          leetcodeUrl: "https://leetcode.cn/problems/rank-one/",
          frequencyScore: 0.5,
        },
      ],
    },
    catalogFile,
  );

  assert.deepEqual(
    result.catalog.entries.map((entry) => entry.leetcodeSlug),
    ["rank-one", "bad-rank", "missing-rank"],
  );
  assert.equal(result.catalog.entries[1].sourceRank, Number.MAX_SAFE_INTEGER);
  assert.equal(result.catalog.entries[2].sourceRank, Number.MAX_SAFE_INTEGER);
});

test("keeps the best duplicate recommendation entry", async () => {
  const catalogFile = path.join(
    await fs.mkdtemp(path.join(os.tmpdir(), "acmcoder-catalog-")),
    "catalog.json",
  );

  const result = await importRecommendationCatalog(
    {
      source: "codetop",
      entries: [
        {
          sourceRank: 1,
          leetcodeSlug: "duplicate-problem",
          title: "Lower Frequency",
          leetcodeUrl: "https://leetcode.cn/problems/duplicate-problem/",
          frequencyScore: 0.6,
        },
        {
          sourceRank: 5,
          leetcodeSlug: "duplicate-problem",
          title: "Higher Frequency Worse Rank",
          leetcodeUrl: "https://leetcode.cn/problems/duplicate-problem/",
          frequencyScore: 0.9,
        },
        {
          sourceRank: 1,
          leetcodeSlug: "duplicate-problem",
          title: "Higher Frequency Better Rank",
          leetcodeUrl: "https://leetcode.cn/problems/duplicate-problem/",
          frequencyScore: 0.9,
        },
      ],
    },
    catalogFile,
  );

  assert.equal(result.importedCount, 1);
  assert.equal(result.catalog.entries[0].title, "Higher Frequency Better Rank");
  assert.equal(result.catalog.entries[0].frequencyScore, 0.9);
  assert.equal(result.catalog.entries[0].sourceRank, 1);
});

test("accepts alternate slug and URL fields while clamping frequency scores", async () => {
  const catalogFile = path.join(
    await fs.mkdtemp(path.join(os.tmpdir(), "acmcoder-catalog-")),
    "catalog.json",
  );

  const result = await importRecommendationCatalog(
    {
      source: "codetop",
      entries: [
        {
          slug: "slug-url-fields",
          url: "https://leetcode.cn/problems/slug-url-fields/",
          frequencyScore: 1.5,
        },
        {
          leetcode: {
            slug: "nested-fields",
            url: "https://leetcode.cn/problems/nested-fields/",
          },
          frequencyScore: -0.2,
        },
      ],
    },
    catalogFile,
  );
  const entriesBySlug = new Map(result.catalog.entries.map((entry) => [entry.leetcodeSlug, entry]));

  assert.equal(entriesBySlug.get("slug-url-fields").leetcodeUrl, "https://leetcode.cn/problems/slug-url-fields/");
  assert.equal(entriesBySlug.get("slug-url-fields").frequencyScore, 1);
  assert.equal(entriesBySlug.get("nested-fields").leetcodeUrl, "https://leetcode.cn/problems/nested-fields/");
  assert.equal(entriesBySlug.get("nested-fields").frequencyScore, 0);
});

test("falls back to the payload source when entry source is whitespace", async () => {
  const catalogFile = path.join(
    await fs.mkdtemp(path.join(os.tmpdir(), "acmcoder-catalog-")),
    "catalog.json",
  );

  const result = await importRecommendationCatalog(
    {
      source: "codetop",
      entries: [
        {
          source: "   ",
          leetcodeSlug: "two-sum",
          leetcodeUrl: "https://leetcode.cn/problems/two-sum/",
        },
      ],
    },
    catalogFile,
  );

  assert.equal(result.catalog.entries[0].source, "codetop");
});

test("loads a bundled catalog when the runtime catalog does not exist", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "acmcoder-catalog-"));
  const runtimeFile = path.join(tempDir, "catalog.json");
  const bundledFile = path.join(tempDir, "default-catalog.json");
  await fs.writeFile(
    bundledFile,
    JSON.stringify({
      version: 1,
      importedAt: "2026-07-11T00:00:00.000Z",
      entries: [
        {
          source: "内置高频题库",
          sourceRank: 1,
          leetcodeSlug: "two-sum",
          title: "两数之和",
          leetcodeUrl: "https://leetcode.cn/problems/two-sum/",
          difficulty: "easy",
          tags: ["数组", "哈希表"],
          frequencyScore: 1,
          lastSyncedAt: "2026-07-11T00:00:00.000Z",
        },
      ],
    }),
    "utf8",
  );

  const catalog = await loadRecommendationCatalog(runtimeFile, bundledFile);

  assert.equal(catalog.entries.length, 1);
  assert.equal(catalog.entries[0].title, "两数之和");
});

test("bundles thirty Chinese recommendation entries without full statements", async () => {
  const bundledFile = path.resolve("data", "recommendation", "default-catalog.json");
  const catalog = JSON.parse(await fs.readFile(bundledFile, "utf8"));

  assert.equal(catalog.entries.length, 30);
  assert.equal(new Set(catalog.entries.map((entry) => entry.leetcodeSlug)).size, 30);
  for (const entry of catalog.entries) {
    assert.match(entry.title, /[\u4e00-\u9fff]/);
    assert.equal(entry.source, "内置高频题库");
    assert.equal(entry.tags.length > 0, true);
    assert.equal(entry.tags.every((tag) => /[\u4e00-\u9fff]/.test(tag)), true);
    assert.equal("content" in entry, false);
    assert.equal("sample" in entry, false);
  }
});

test("exports all or selected recommendation entries in an import-compatible format", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "acmcoder-catalog-"));
  const catalogFile = path.join(tempDir, "catalog.json");
  await importRecommendationCatalog(
    {
      source: "内置高频题库",
      entries: [
        {
          leetcodeSlug: "two-sum",
          title: "两数之和",
          leetcodeUrl: "https://leetcode.cn/problems/two-sum/",
          frequencyScore: 1,
        },
        {
          leetcodeSlug: "lru-cache",
          title: "LRU 缓存",
          leetcodeUrl: "https://leetcode.cn/problems/lru-cache/",
          frequencyScore: 0.9,
        },
      ],
    },
    catalogFile,
    "2026-07-11T01:00:00.000Z",
  );

  const all = await exportRecommendationCatalog({}, catalogFile, "2026-07-11T02:00:00.000Z");
  const selected = await exportRecommendationCatalog(
    { slugs: ["lru-cache"] },
    catalogFile,
    "2026-07-11T02:00:00.000Z",
  );

  assert.equal(all.format, "acmcoder-recommendation-catalog-v1");
  assert.equal(all.exportedAt, "2026-07-11T02:00:00.000Z");
  assert.equal(all.entries.length, 2);
  assert.deepEqual(selected.entries.map((entry) => entry.leetcodeSlug), ["lru-cache"]);
});

test("deletes selected entries and persists an explicitly empty runtime catalog", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "acmcoder-catalog-"));
  const runtimeFile = path.join(tempDir, "catalog.json");
  const bundledFile = path.join(tempDir, "default-catalog.json");
  await fs.writeFile(
    bundledFile,
    JSON.stringify({
      version: 1,
      importedAt: "2026-07-11T00:00:00.000Z",
      entries: [
        {
          source: "内置高频题库",
          sourceRank: 1,
          leetcodeSlug: "two-sum",
          title: "两数之和",
          leetcodeUrl: "https://leetcode.cn/problems/two-sum/",
          difficulty: "easy",
          tags: ["数组"],
          frequencyScore: 1,
          lastSyncedAt: "2026-07-11T00:00:00.000Z",
        },
      ],
    }),
    "utf8",
  );

  const result = await deleteRecommendationCatalogEntries(
    { slugs: ["two-sum"] },
    runtimeFile,
    "2026-07-11T03:00:00.000Z",
    bundledFile,
  );
  const loaded = await loadRecommendationCatalog(runtimeFile, bundledFile);

  assert.deepEqual(result.deletedSlugs, ["two-sum"]);
  assert.deepEqual(result.catalog.entries, []);
  assert.equal(loaded.importedAt, "2026-07-11T03:00:00.000Z");
  assert.deepEqual(loaded.entries, []);
});

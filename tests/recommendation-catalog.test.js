import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
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

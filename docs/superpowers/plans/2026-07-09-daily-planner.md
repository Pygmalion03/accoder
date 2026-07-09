# Daily Planner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an AI-centered daily LeetCode practice planner that imports a CodeTop-style recommendation catalog, generates personalized daily plans, and lets users open or add recommended problems without changing the existing runner model.

**Architecture:** Add focused server modules for catalog storage, planner profile state, candidate ranking, AI/fallback plan generation, and daily plan persistence. Integrate them into the existing `createAcmcoderServer()` HTTP server and expose a compact Web UI panel in the existing single-page app. The runner layer remains unchanged: Daily Planner chooses practice items; local/Docker runner still executes submitted code.

**Tech Stack:** Node.js ESM, built-in `node:test`, built-in `fetch`, local JSON files under `data/recommendation/` and `data/memory/`, existing OpenAI-compatible assist settings.

---

## Pre-Flight

- Current branch is `v2.2`.
- Existing untracked directories `docs/lesson/` and `output/` are user/local artifacts. Do not stage or modify them unless explicitly requested.
- The design spec is `docs/superpowers/specs/2026-07-09-daily-planner-design.md`.
- Use `node --test <test-file>` for focused tests and `npm test` before final completion.
- Do not push to GitHub during implementation.

## File Structure

Create:

- `src/server/recommendation-catalog.js`: import, normalize, persist, and load external recommendation metadata.
- `src/server/planner-profile.js`: persist lightweight planner actions and merge them with existing AC progress.
- `src/server/candidate-generator.js`: deterministic filtering and ranking before AI selection.
- `src/server/daily-plan.js`: AI request/validation, fallback planning, daily plan store, and plan item action updates.
- `tests/recommendation-catalog.test.js`: catalog normalization and import behavior.
- `tests/planner-profile.test.js`: profile defaults and action state behavior.
- `tests/candidate-generator.test.js`: scoring, cooldown, and mastered filtering.
- `tests/daily-plan.test.js`: AI JSON validation, fallback, and store behavior.
- `tests/daily-plan-api.test.js`: HTTP route integration.

Modify:

- `src/server/server.js`: inject new file paths and expose recommendation/daily plan APIs.
- `web/index.html`: add Daily Planner controls and recommendation list container.
- `web/app.js`: add catalog import, plan generation, plan rendering, and item actions.
- `web/styles.css`: style daily planner controls and list.
- `tests/web-copy.test.js`: assert UI/API hooks exist.

Do not modify:

- `src/runner/*`: code execution remains local/Docker runner.
- `Dockerfile`, `Dockerfile.app`, `docker-compose*.yml`: no new runtime dependency is required.

---

### Task 1: Recommendation Catalog Storage

**Files:**
- Create: `src/server/recommendation-catalog.js`
- Test: `tests/recommendation-catalog.test.js`

- [ ] **Step 1: Write the failing catalog import tests**

Create `tests/recommendation-catalog.test.js`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { importRecommendationCatalog, loadRecommendationCatalog } from "../src/server/recommendation-catalog.js";

test("imports CodeTop-style recommendation entries into a local catalog", async () => {
  const catalogFile = path.join(await fs.mkdtemp(path.join(os.tmpdir(), "acmcoder-catalog-")), "catalog.json");

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
  const catalogFile = path.join(await fs.mkdtemp(path.join(os.tmpdir(), "acmcoder-catalog-")), "catalog.json");

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
});

test("returns an empty catalog when the catalog file does not exist", async () => {
  const catalogFile = path.join(await fs.mkdtemp(path.join(os.tmpdir(), "acmcoder-catalog-")), "missing.json");
  const catalog = await loadRecommendationCatalog(catalogFile);

  assert.equal(catalog.version, 1);
  assert.deepEqual(catalog.entries, []);
});
```

- [ ] **Step 2: Run the catalog tests and verify they fail**

Run:

```powershell
node --test tests/recommendation-catalog.test.js
```

Expected: FAIL with an import error for `src/server/recommendation-catalog.js`.

- [ ] **Step 3: Implement recommendation catalog storage**

Create `src/server/recommendation-catalog.js`:

```js
import fs from "node:fs/promises";
import path from "node:path";

import { projectRoot } from "../core/problems.js";

const defaultRecommendationCatalogFile = path.join(projectRoot, "data", "recommendation", "catalog.json");

export function getDefaultRecommendationCatalogFile() {
  return defaultRecommendationCatalogFile;
}

function normalizeDifficulty(value) {
  const difficulty = String(value || "").trim().toLowerCase();
  const map = {
    "简单": "easy",
    "中等": "medium",
    "困难": "hard",
  };
  return map[difficulty] || difficulty;
}

function uniqueStrings(values = []) {
  return Array.from(new Set((Array.isArray(values) ? values : []).map((value) => String(value).trim()).filter(Boolean)));
}

function numericOrDefault(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function normalizeCatalogEntry(entry = {}, source = "codetop", syncedAt = new Date().toISOString()) {
  const leetcodeSlug = String(entry.leetcodeSlug || entry.slug || entry.leetcode?.slug || "").trim();
  if (!leetcodeSlug) {
    throw new Error("Missing recommendation slug.");
  }

  const leetcodeUrl = String(entry.leetcodeUrl || entry.url || entry.leetcode?.url || "").trim();
  if (!leetcodeUrl) {
    throw new Error(`Missing LeetCode URL for recommendation: ${leetcodeSlug}`);
  }

  return {
    source: String(entry.source || source || "codetop").trim() || "codetop",
    sourceRank: Math.max(0, Math.floor(numericOrDefault(entry.sourceRank ?? entry.rank, 0))),
    leetcodeSlug,
    title: String(entry.title || leetcodeSlug).trim() || leetcodeSlug,
    leetcodeUrl,
    difficulty: normalizeDifficulty(entry.difficulty),
    tags: uniqueStrings(entry.tags),
    frequencyScore: Math.max(0, Math.min(1, numericOrDefault(entry.frequencyScore ?? entry.frequency, 0))),
    lastSyncedAt: String(entry.lastSyncedAt || syncedAt),
  };
}

function entriesFromPayload(payload = {}) {
  if (Array.isArray(payload)) {
    return payload;
  }
  if (Array.isArray(payload.entries)) {
    return payload.entries;
  }
  if (Array.isArray(payload.problems)) {
    return payload.problems;
  }
  throw new Error("Recommendation catalog import requires an entries array.");
}

function sortEntries(entries) {
  return [...entries].sort((a, b) => {
    if (b.frequencyScore !== a.frequencyScore) {
      return b.frequencyScore - a.frequencyScore;
    }
    if (a.sourceRank !== b.sourceRank) {
      return a.sourceRank - b.sourceRank;
    }
    return a.leetcodeSlug.localeCompare(b.leetcodeSlug);
  });
}

export async function loadRecommendationCatalog(catalogFile = defaultRecommendationCatalogFile) {
  try {
    const body = JSON.parse(await fs.readFile(catalogFile, "utf8"));
    const entries = Array.isArray(body.entries) ? body.entries.map((entry) => normalizeCatalogEntry(entry, entry.source, entry.lastSyncedAt)) : [];
    return {
      version: 1,
      importedAt: body.importedAt || "",
      entries: sortEntries(entries),
    };
  } catch (error) {
    if (error.code === "ENOENT") {
      return { version: 1, importedAt: "", entries: [] };
    }
    throw error;
  }
}

export async function importRecommendationCatalog(payload, catalogFile = defaultRecommendationCatalogFile, importedAt = new Date().toISOString()) {
  const source = String(payload?.source || "codetop").trim() || "codetop";
  const normalized = entriesFromPayload(payload).map((entry) => normalizeCatalogEntry(entry, source, importedAt));
  const bySlug = new Map();

  for (const entry of normalized) {
    bySlug.set(entry.leetcodeSlug, entry);
  }

  const catalog = {
    version: 1,
    importedAt,
    entries: sortEntries([...bySlug.values()]),
  };

  await fs.mkdir(path.dirname(catalogFile), { recursive: true });
  await fs.writeFile(catalogFile, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");

  return {
    importedCount: catalog.entries.length,
    catalog,
  };
}
```

- [ ] **Step 4: Run the catalog tests and verify they pass**

Run:

```powershell
node --test tests/recommendation-catalog.test.js
```

Expected: PASS for all tests in `tests/recommendation-catalog.test.js`.

- [ ] **Step 5: Commit catalog storage**

Run:

```powershell
git add src/server/recommendation-catalog.js tests/recommendation-catalog.test.js
git commit -m "feat: add recommendation catalog storage"
```

---

### Task 2: Planner Profile State

**Files:**
- Create: `src/server/planner-profile.js`
- Test: `tests/planner-profile.test.js`

- [ ] **Step 1: Write the failing profile tests**

Create `tests/planner-profile.test.js`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { buildPracticeProfile, loadPlannerProfile, updatePlannerAction } from "../src/server/planner-profile.js";

test("loads default planner profile settings when no profile exists", async () => {
  const profileFile = path.join(await fs.mkdtemp(path.join(os.tmpdir(), "acmcoder-profile-")), "profile.json");
  const profile = await loadPlannerProfile(profileFile);

  assert.equal(profile.version, 1);
  assert.equal(profile.settings.dailyCount, 3);
  assert.equal(profile.settings.difficultyPressure, "standard");
  assert.equal(profile.settings.cooldownDays, 3);
  assert.deepEqual(profile.items, {});
});

test("records planner item actions by slug", async () => {
  const profileFile = path.join(await fs.mkdtemp(path.join(os.tmpdir(), "acmcoder-profile-")), "profile.json");

  const skipped = await updatePlannerAction("two-sum", "skip", profileFile, "2026-07-09T12:00:00.000Z");
  assert.equal(skipped.items["two-sum"].skippedAt, "2026-07-09T12:00:00.000Z");

  const mastered = await updatePlannerAction("two-sum", "mastered", profileFile, "2026-07-09T12:05:00.000Z");
  assert.equal(mastered.items["two-sum"].masteredAt, "2026-07-09T12:05:00.000Z");
  assert.equal(mastered.items["two-sum"].wantPracticeAgain, false);

  const revisit = await updatePlannerAction("two-sum", "want_practice_again", profileFile, "2026-07-09T12:10:00.000Z");
  assert.equal(revisit.items["two-sum"].wantPracticeAgain, true);
  assert.equal(revisit.items["two-sum"].updatedAt, "2026-07-09T12:10:00.000Z");
});

test("merges accepted progress with planner action state", () => {
  const profile = {
    version: 1,
    settings: { dailyCount: 3, difficultyPressure: "standard", cooldownDays: 3, targetTags: [] },
    items: {
      "two-sum": {
        leetcodeSlug: "two-sum",
        skippedAt: "2026-07-08T10:00:00.000Z",
        masteredAt: "",
        wantPracticeAgain: false,
      },
    },
  };

  const merged = buildPracticeProfile({
    profile,
    progressItems: {
      "two-sum": {
        slug: "two-sum",
        acCount: 2,
        lastAcceptedAt: "2026-07-09T10:00:00.000Z",
      },
    },
  });

  assert.equal(merged.items["two-sum"].acceptedCount, 2);
  assert.equal(merged.items["two-sum"].lastPracticedAt, "2026-07-09T10:00:00.000Z");
  assert.equal(merged.items["two-sum"].skippedAt, "2026-07-08T10:00:00.000Z");
});
```

- [ ] **Step 2: Run the profile tests and verify they fail**

Run:

```powershell
node --test tests/planner-profile.test.js
```

Expected: FAIL with an import error for `src/server/planner-profile.js`.

- [ ] **Step 3: Implement planner profile state**

Create `src/server/planner-profile.js`:

```js
import fs from "node:fs/promises";
import path from "node:path";

import { projectRoot } from "../core/problems.js";

const defaultPlannerProfileFile = path.join(projectRoot, "data", "memory", "planner-profile.json");

const defaultSettings = {
  dailyCount: 3,
  difficultyPressure: "standard",
  cooldownDays: 3,
  targetTags: [],
};

export function getDefaultPlannerProfileFile() {
  return defaultPlannerProfileFile;
}

function normalizeSlug(slug) {
  return String(slug || "").replace(/^memory:/, "").trim();
}

function normalizeSettings(settings = {}) {
  const dailyCount = Math.max(1, Math.min(5, Math.floor(Number(settings.dailyCount || defaultSettings.dailyCount))));
  const cooldownDays = Math.max(0, Math.floor(Number(settings.cooldownDays ?? defaultSettings.cooldownDays)));
  const difficultyPressure = ["conservative", "standard", "intensive"].includes(settings.difficultyPressure)
    ? settings.difficultyPressure
    : defaultSettings.difficultyPressure;
  const targetTags = Array.from(new Set((Array.isArray(settings.targetTags) ? settings.targetTags : []).map(String).map((tag) => tag.trim()).filter(Boolean)));

  return {
    dailyCount,
    difficultyPressure,
    cooldownDays,
    targetTags,
  };
}

function emptyItem(slug) {
  return {
    leetcodeSlug: slug,
    openedAt: "",
    addedToPracticeAt: "",
    skippedAt: "",
    masteredAt: "",
    wantPracticeAgain: false,
    updatedAt: "",
  };
}

function normalizeItem(slug, item = {}) {
  const leetcodeSlug = normalizeSlug(slug || item.leetcodeSlug);
  return {
    ...emptyItem(leetcodeSlug),
    openedAt: typeof item.openedAt === "string" ? item.openedAt : "",
    addedToPracticeAt: typeof item.addedToPracticeAt === "string" ? item.addedToPracticeAt : "",
    skippedAt: typeof item.skippedAt === "string" ? item.skippedAt : "",
    masteredAt: typeof item.masteredAt === "string" ? item.masteredAt : "",
    wantPracticeAgain: Boolean(item.wantPracticeAgain),
    updatedAt: typeof item.updatedAt === "string" ? item.updatedAt : "",
  };
}

export async function loadPlannerProfile(profileFile = defaultPlannerProfileFile) {
  try {
    const body = JSON.parse(await fs.readFile(profileFile, "utf8"));
    const rawItems = body?.items && typeof body.items === "object" ? body.items : {};
    const items = {};

    for (const [slug, item] of Object.entries(rawItems)) {
      const normalized = normalizeItem(slug, item);
      if (normalized.leetcodeSlug) {
        items[normalized.leetcodeSlug] = normalized;
      }
    }

    return {
      version: 1,
      settings: normalizeSettings(body.settings),
      items,
    };
  } catch (error) {
    if (error.code === "ENOENT") {
      return { version: 1, settings: normalizeSettings(), items: {} };
    }
    throw error;
  }
}

async function savePlannerProfile(profile, profileFile = defaultPlannerProfileFile) {
  await fs.mkdir(path.dirname(profileFile), { recursive: true });
  await fs.writeFile(profileFile, `${JSON.stringify(profile, null, 2)}\n`, "utf8");
}

export async function updatePlannerAction(slug, action, profileFile = defaultPlannerProfileFile, timestamp = new Date().toISOString()) {
  const leetcodeSlug = normalizeSlug(slug);
  if (!leetcodeSlug) {
    throw new Error("Missing planner action slug.");
  }

  const profile = await loadPlannerProfile(profileFile);
  const current = normalizeItem(leetcodeSlug, profile.items[leetcodeSlug]);
  const next = { ...current, updatedAt: timestamp };

  if (action === "open") {
    next.openedAt = timestamp;
  } else if (action === "add_to_practice") {
    next.addedToPracticeAt = timestamp;
  } else if (action === "skip") {
    next.skippedAt = timestamp;
  } else if (action === "mastered") {
    next.masteredAt = timestamp;
    next.wantPracticeAgain = false;
  } else if (action === "want_practice_again") {
    next.wantPracticeAgain = true;
    next.masteredAt = "";
  } else {
    throw new Error(`Unsupported planner action: ${action}`);
  }

  profile.items[leetcodeSlug] = next;
  await savePlannerProfile(profile, profileFile);
  return profile;
}

export function buildPracticeProfile({ profile, progressItems = {} } = {}) {
  const settings = normalizeSettings(profile?.settings);
  const items = {};

  for (const [slug, item] of Object.entries(profile?.items || {})) {
    const normalized = normalizeItem(slug, item);
    if (normalized.leetcodeSlug) {
      items[normalized.leetcodeSlug] = {
        ...normalized,
        acceptedCount: 0,
        lastPracticedAt: "",
      };
    }
  }

  for (const [slug, progress] of Object.entries(progressItems)) {
    const leetcodeSlug = normalizeSlug(slug || progress.slug);
    if (!leetcodeSlug) {
      continue;
    }
    const current = items[leetcodeSlug] || { ...emptyItem(leetcodeSlug), acceptedCount: 0, lastPracticedAt: "" };
    items[leetcodeSlug] = {
      ...current,
      acceptedCount: Math.max(0, Math.floor(Number(progress.acCount || 0))),
      lastPracticedAt: typeof progress.lastAcceptedAt === "string" ? progress.lastAcceptedAt : current.lastPracticedAt || "",
    };
  }

  return {
    version: 1,
    settings,
    items,
  };
}
```

- [ ] **Step 4: Run the profile tests and verify they pass**

Run:

```powershell
node --test tests/planner-profile.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit profile state**

Run:

```powershell
git add src/server/planner-profile.js tests/planner-profile.test.js
git commit -m "feat: track daily planner profile state"
```

---

### Task 3: Candidate Generator

**Files:**
- Create: `src/server/candidate-generator.js`
- Test: `tests/candidate-generator.test.js`

- [ ] **Step 1: Write the failing candidate generator tests**

Create `tests/candidate-generator.test.js`:

```js
import test from "node:test";
import assert from "node:assert/strict";

import { generateCandidates } from "../src/server/candidate-generator.js";

const catalog = [
  {
    leetcodeSlug: "two-sum",
    title: "Two Sum",
    leetcodeUrl: "https://leetcode.cn/problems/two-sum/",
    difficulty: "easy",
    tags: ["array", "hash-table"],
    frequencyScore: 1,
    sourceRank: 1,
  },
  {
    leetcodeSlug: "lru-cache",
    title: "LRU Cache",
    leetcodeUrl: "https://leetcode.cn/problems/lru-cache/",
    difficulty: "medium",
    tags: ["hash-table", "linked-list", "design"],
    frequencyScore: 0.9,
    sourceRank: 2,
  },
  {
    leetcodeSlug: "merge-k-sorted-lists",
    title: "Merge k Sorted Lists",
    leetcodeUrl: "https://leetcode.cn/problems/merge-k-sorted-lists/",
    difficulty: "hard",
    tags: ["linked-list", "heap"],
    frequencyScore: 0.8,
    sourceRank: 3,
  },
];

test("ranks candidates by frequency, target tag, and unseen status", () => {
  const candidates = generateCandidates({
    catalogEntries: catalog,
    practiceProfile: {
      settings: { targetTags: ["linked-list"], difficultyPressure: "standard", cooldownDays: 3 },
      items: {},
    },
    today: "2026-07-09T00:00:00.000Z",
  });

  assert.equal(candidates[0].leetcodeSlug, "lru-cache");
  assert.equal(candidates[0].score > candidates[1].score, true);
  assert.equal(candidates.some((candidate) => candidate.leetcodeSlug === "merge-k-sorted-lists"), true);
});

test("excludes mastered problems unless the user wants to practice again", () => {
  const candidates = generateCandidates({
    catalogEntries: catalog,
    practiceProfile: {
      settings: { targetTags: [], difficultyPressure: "standard", cooldownDays: 3 },
      items: {
        "two-sum": { masteredAt: "2026-07-08T00:00:00.000Z", wantPracticeAgain: false },
        "lru-cache": { masteredAt: "2026-07-08T00:00:00.000Z", wantPracticeAgain: true },
      },
    },
    today: "2026-07-09T00:00:00.000Z",
  });

  assert.equal(candidates.some((candidate) => candidate.leetcodeSlug === "two-sum"), false);
  assert.equal(candidates.some((candidate) => candidate.leetcodeSlug === "lru-cache"), true);
});

test("penalizes problems accepted inside the cooldown window", () => {
  const candidates = generateCandidates({
    catalogEntries: catalog,
    practiceProfile: {
      settings: { targetTags: [], difficultyPressure: "standard", cooldownDays: 3 },
      items: {
        "two-sum": {
          acceptedCount: 1,
          lastPracticedAt: "2026-07-08T00:00:00.000Z",
        },
      },
    },
    today: "2026-07-09T00:00:00.000Z",
  });

  const twoSum = candidates.find((candidate) => candidate.leetcodeSlug === "two-sum");
  const lru = candidates.find((candidate) => candidate.leetcodeSlug === "lru-cache");

  assert.equal(twoSum.score < lru.score, true);
  assert.match(twoSum.reasons.join(" "), /recently practiced/);
});
```

- [ ] **Step 2: Run the candidate tests and verify they fail**

Run:

```powershell
node --test tests/candidate-generator.test.js
```

Expected: FAIL with an import error for `src/server/candidate-generator.js`.

- [ ] **Step 3: Implement candidate generation**

Create `src/server/candidate-generator.js`:

```js
const dayMs = 24 * 60 * 60 * 1000;

function difficultyWeight(difficulty, pressure) {
  const normalized = String(difficulty || "").toLowerCase();
  if (pressure === "conservative") {
    return normalized === "easy" ? 14 : normalized === "medium" ? 8 : -8;
  }
  if (pressure === "intensive") {
    return normalized === "hard" ? 14 : normalized === "medium" ? 10 : 4;
  }
  return normalized === "medium" ? 12 : normalized === "easy" ? 8 : 6;
}

function daysBetween(today, timestamp) {
  const end = Date.parse(today);
  const start = Date.parse(timestamp || "");
  if (!Number.isFinite(end) || !Number.isFinite(start)) {
    return Infinity;
  }
  return Math.floor((end - start) / dayMs);
}

function targetTagScore(tags = [], targetTags = []) {
  if (targetTags.length === 0) {
    return 0;
  }
  const tagSet = new Set(tags);
  return targetTags.filter((tag) => tagSet.has(tag)).length * 16;
}

function normalizeCandidateEntry(entry = {}) {
  return {
    leetcodeSlug: String(entry.leetcodeSlug || "").trim(),
    title: String(entry.title || entry.leetcodeSlug || "").trim(),
    leetcodeUrl: String(entry.leetcodeUrl || "").trim(),
    difficulty: String(entry.difficulty || "").toLowerCase(),
    tags: Array.isArray(entry.tags) ? entry.tags.map(String).filter(Boolean) : [],
    frequencyScore: Math.max(0, Math.min(1, Number(entry.frequencyScore || 0))),
    sourceRank: Math.max(0, Math.floor(Number(entry.sourceRank || 0))),
  };
}

export function generateCandidates({ catalogEntries = [], practiceProfile = {}, today = new Date().toISOString(), limit = 30 } = {}) {
  const settings = practiceProfile.settings || {};
  const targetTags = Array.isArray(settings.targetTags) ? settings.targetTags : [];
  const pressure = settings.difficultyPressure || "standard";
  const cooldownDays = Math.max(0, Math.floor(Number(settings.cooldownDays ?? 3)));
  const scored = [];

  for (const rawEntry of catalogEntries) {
    const entry = normalizeCandidateEntry(rawEntry);
    if (!entry.leetcodeSlug || !entry.leetcodeUrl) {
      continue;
    }

    const item = practiceProfile.items?.[entry.leetcodeSlug] || {};
    if (item.masteredAt && !item.wantPracticeAgain) {
      continue;
    }

    const reasons = [];
    let score = 0;

    score += entry.frequencyScore * 100;
    if (entry.frequencyScore > 0) {
      reasons.push("high frequency");
    }

    const tagScore = targetTagScore(entry.tags, targetTags);
    score += tagScore;
    if (tagScore > 0) {
      reasons.push("matches target tags");
    }

    score += difficultyWeight(entry.difficulty, pressure);

    const acceptedCount = Math.max(0, Math.floor(Number(item.acceptedCount || 0)));
    if (acceptedCount === 0) {
      score += 12;
      reasons.push("not accepted yet");
    } else {
      score -= acceptedCount * 8;
    }

    if (item.wantPracticeAgain) {
      score += 18;
      reasons.push("marked for revisit");
    }

    if (item.skippedAt) {
      score -= 10;
      reasons.push("previously skipped");
    }

    const daysSincePractice = daysBetween(today, item.lastPracticedAt);
    if (daysSincePractice < cooldownDays) {
      score -= 40;
      reasons.push("recently practiced");
    } else if (Number.isFinite(daysSincePractice)) {
      score += Math.min(12, daysSincePractice);
      reasons.push("ready for revisit");
    }

    scored.push({
      ...entry,
      score,
      reasons,
    });
  }

  return scored
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      if (a.sourceRank !== b.sourceRank) {
        return a.sourceRank - b.sourceRank;
      }
      return a.leetcodeSlug.localeCompare(b.leetcodeSlug);
    })
    .slice(0, limit);
}
```

- [ ] **Step 4: Run the candidate tests and verify they pass**

Run:

```powershell
node --test tests/candidate-generator.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit candidate generation**

Run:

```powershell
git add src/server/candidate-generator.js tests/candidate-generator.test.js
git commit -m "feat: rank daily planner candidates"
```

---

### Task 4: Daily Plan Generation and Store

**Files:**
- Create: `src/server/daily-plan.js`
- Test: `tests/daily-plan.test.js`

- [ ] **Step 1: Write the failing daily plan tests**

Create `tests/daily-plan.test.js`:

```js
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
    () => validateAiPlan({ theme: "bad", items: [{ leetcodeSlug: "unknown" }] }, candidates, "2026-07-09"),
    /unknown candidate/,
  );

  assert.throws(
    () => validateAiPlan({ theme: "bad", items: [{ leetcodeSlug: "two-sum" }, { leetcodeSlug: "two-sum" }] }, candidates, "2026-07-09"),
    /duplicate candidate/,
  );
});

test("creates a deterministic fallback plan from ranked candidates", () => {
  const plan = createFallbackPlan({ candidates, date: "2026-07-09", count: 2 });

  assert.equal(plan.source, "fallback");
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
```

- [ ] **Step 2: Run the daily plan tests and verify they fail**

Run:

```powershell
node --test tests/daily-plan.test.js
```

Expected: FAIL with an import error for `src/server/daily-plan.js`.

- [ ] **Step 3: Implement daily plan generation and storage**

Create `src/server/daily-plan.js`:

```js
import fs from "node:fs/promises";
import path from "node:path";

import { projectRoot } from "../core/problems.js";

const defaultDailyPlanFile = path.join(projectRoot, "data", "memory", "daily-plans.json");

export function getDefaultDailyPlanFile() {
  return defaultDailyPlanFile;
}

function emptyActions() {
  return {
    opened: false,
    addedToPractice: false,
    skipped: false,
    mastered: false,
    wantPracticeAgain: false,
  };
}

function difficultyMixFor(items) {
  return items.reduce(
    (mix, item) => {
      if (item.difficulty === "easy") mix.easy += 1;
      if (item.difficulty === "medium") mix.medium += 1;
      if (item.difficulty === "hard") mix.hard += 1;
      return mix;
    },
    { easy: 0, medium: 0, hard: 0 },
  );
}

function normalizeCount(count) {
  return Math.max(1, Math.min(5, Math.floor(Number(count || 3))));
}

function planItemFromCandidate(candidate, overrides = {}) {
  return {
    leetcodeSlug: candidate.leetcodeSlug,
    title: candidate.title,
    leetcodeUrl: candidate.leetcodeUrl,
    difficulty: candidate.difficulty,
    tags: candidate.tags || [],
    focus: String(overrides.focus || candidate.tags?.[0] || candidate.difficulty || "practice"),
    reason: String(overrides.reason || "Selected by deterministic fallback ranking."),
    estimatedMinutes: Math.max(10, Math.min(90, Math.floor(Number(overrides.estimatedMinutes || 25)))),
    actions: {
      ...emptyActions(),
      ...(overrides.actions || {}),
    },
  };
}

export function validateAiPlan(rawPlan, candidates = [], date = new Date().toISOString().slice(0, 10)) {
  const candidateBySlug = new Map(candidates.map((candidate) => [candidate.leetcodeSlug, candidate]));
  const seen = new Set();
  const items = [];

  if (!rawPlan || !Array.isArray(rawPlan.items)) {
    throw new Error("AI plan did not include items.");
  }

  for (const rawItem of rawPlan.items) {
    const slug = String(rawItem.leetcodeSlug || "").trim();
    if (!candidateBySlug.has(slug)) {
      throw new Error(`AI plan selected unknown candidate: ${slug}`);
    }
    if (seen.has(slug)) {
      throw new Error(`AI plan selected duplicate candidate: ${slug}`);
    }
    seen.add(slug);
    items.push(planItemFromCandidate(candidateBySlug.get(slug), rawItem));
  }

  if (items.length === 0) {
    throw new Error("AI plan selected no valid candidates.");
  }

  return {
    version: 1,
    date,
    source: "ai",
    theme: String(rawPlan.theme || "Daily interview practice").trim() || "Daily interview practice",
    difficultyMix: difficultyMixFor(items),
    items,
  };
}

export function createFallbackPlan({ candidates = [], date = new Date().toISOString().slice(0, 10), count = 3 } = {}) {
  const items = candidates.slice(0, normalizeCount(count)).map((candidate) => planItemFromCandidate(candidate));
  return {
    version: 1,
    date,
    source: "fallback",
    theme: "High-frequency daily practice",
    difficultyMix: difficultyMixFor(items),
    items,
  };
}

async function loadPlanStore(planFile = defaultDailyPlanFile) {
  try {
    const body = JSON.parse(await fs.readFile(planFile, "utf8"));
    return {
      version: 1,
      plans: body?.plans && typeof body.plans === "object" ? body.plans : {},
    };
  } catch (error) {
    if (error.code === "ENOENT") {
      return { version: 1, plans: {} };
    }
    throw error;
  }
}

async function savePlanStore(store, planFile = defaultDailyPlanFile) {
  await fs.mkdir(path.dirname(planFile), { recursive: true });
  await fs.writeFile(planFile, `${JSON.stringify(store, null, 2)}\n`, "utf8");
}

export async function loadDailyPlan(date = new Date().toISOString().slice(0, 10), planFile = defaultDailyPlanFile) {
  const store = await loadPlanStore(planFile);
  return store.plans[date] || null;
}

async function saveDailyPlan(plan, planFile = defaultDailyPlanFile) {
  const store = await loadPlanStore(planFile);
  store.plans[plan.date] = plan;
  await savePlanStore(store, planFile);
  return plan;
}

function extractJsonObject(text) {
  const value = String(text || "").trim();
  if (value.startsWith("{")) {
    return JSON.parse(value);
  }
  const fenced = value.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) {
    return JSON.parse(fenced[1]);
  }
  const start = value.indexOf("{");
  const end = value.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return JSON.parse(value.slice(start, end + 1));
  }
  throw new Error("AI response did not contain JSON.");
}

async function requestAiPlan({ settings = {}, fetch, candidates = [], count = 3, date }) {
  if (!settings.apiKey) {
    throw new Error("Planner API key is not configured.");
  }
  const fetchFn = fetch || globalThis.fetch;
  if (!fetchFn) {
    throw new Error("fetch is not available in this Node.js runtime.");
  }

  const response = await fetchFn(`${String(settings.baseUrl || "https://api.openai.com/v1").replace(/\/+$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${settings.apiKey}`,
    },
    body: JSON.stringify({
      model: settings.model || "gpt-4.1-mini",
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content:
            "You are ACMCoder Daily Planner. Select only from the provided candidate slugs. Return strict JSON with theme and items. Do not invent problems.",
        },
        {
          role: "user",
          content: JSON.stringify({
            date,
            count: normalizeCount(count),
            candidates: candidates.map((candidate) => ({
              leetcodeSlug: candidate.leetcodeSlug,
              title: candidate.title,
              difficulty: candidate.difficulty,
              tags: candidate.tags,
              score: candidate.score,
              reasons: candidate.reasons || [],
            })),
            schema: {
              theme: "string",
              items: [{ leetcodeSlug: "string", focus: "string", reason: "string", estimatedMinutes: 25 }],
            },
          }),
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Planner model request failed: ${response.status}`);
  }
  const body = await response.json();
  return extractJsonObject(body.choices?.[0]?.message?.content || "");
}

export async function generateDailyPlan({
  candidates = [],
  date = new Date().toISOString().slice(0, 10),
  count = 3,
  planFile = defaultDailyPlanFile,
  settings = {},
  fetch,
} = {}) {
  let plan;
  try {
    const rawPlan = await requestAiPlan({ settings, fetch, candidates, count, date });
    plan = validateAiPlan(rawPlan, candidates, date);
  } catch {
    plan = createFallbackPlan({ candidates, date, count });
  }
  return saveDailyPlan(plan, planFile);
}

export async function updateDailyPlanItemAction({ planFile = defaultDailyPlanFile, date = new Date().toISOString().slice(0, 10), slug, action } = {}) {
  const plan = await loadDailyPlan(date, planFile);
  if (!plan) {
    throw new Error(`No daily plan found for ${date}.`);
  }

  const item = plan.items.find((entry) => entry.leetcodeSlug === slug);
  if (!item) {
    throw new Error(`Daily plan item not found: ${slug}`);
  }

  if (action === "open") item.actions.opened = true;
  else if (action === "add_to_practice") item.actions.addedToPractice = true;
  else if (action === "skip") item.actions.skipped = true;
  else if (action === "mastered") item.actions.mastered = true;
  else if (action === "want_practice_again") item.actions.wantPracticeAgain = true;
  else throw new Error(`Unsupported daily plan action: ${action}`);

  return saveDailyPlan(plan, planFile);
}
```

- [ ] **Step 4: Run the daily plan tests and verify they pass**

Run:

```powershell
node --test tests/daily-plan.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit daily plan generation**

Run:

```powershell
git add src/server/daily-plan.js tests/daily-plan.test.js
git commit -m "feat: generate daily practice plans"
```

---

### Task 5: HTTP API Integration

**Files:**
- Modify: `src/server/server.js`
- Test: `tests/daily-plan-api.test.js`

- [ ] **Step 1: Write the failing API integration tests**

Create `tests/daily-plan-api.test.js`:

```js
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
```

- [ ] **Step 2: Run the API tests and verify they fail**

Run:

```powershell
node --test tests/daily-plan-api.test.js
```

Expected: FAIL because routes are not registered.

- [ ] **Step 3: Add imports and option wiring to `src/server/server.js`**

Modify the import section:

```js
import { generateCandidates } from "./candidate-generator.js";
import {
  generateDailyPlan,
  getDefaultDailyPlanFile,
  loadDailyPlan,
  updateDailyPlanItemAction,
} from "./daily-plan.js";
import {
  getDefaultPlannerProfileFile,
  buildPracticeProfile,
  loadPlannerProfile,
  updatePlannerAction,
} from "./planner-profile.js";
import {
  getDefaultRecommendationCatalogFile,
  importRecommendationCatalog,
  loadRecommendationCatalog,
} from "./recommendation-catalog.js";
```

Inside `createAcmcoderServer(options = {})`, add file options near existing defaults:

```js
  const recommendationCatalogFile = options.recommendationCatalogFile || getDefaultRecommendationCatalogFile();
  const plannerProfileFile = options.plannerProfileFile || getDefaultPlannerProfileFile();
  const dailyPlanFile = options.dailyPlanFile || getDefaultDailyPlanFile();
```

- [ ] **Step 4: Add helper functions for planner generation and add-to-practice**

Add these helper functions above `createAcmcoderServer`:

```js
function todayDate(value) {
  return String(value || new Date().toISOString().slice(0, 10)).slice(0, 10);
}

function memoryPageFromPlanItem(item) {
  return {
    source: "leetcode",
    url: item.leetcodeUrl,
    slug: item.leetcodeSlug,
    frontendId: "",
    title: item.title || item.leetcodeSlug,
    difficulty: item.difficulty || "",
    tags: Array.isArray(item.tags) ? item.tags : [],
    sample: null,
    content: `Open the LeetCode link for the full statement. ACMCoder stores only recommendation metadata for ${item.title || item.leetcodeSlug}.`,
    capturedAt: new Date().toISOString(),
  };
}

async function buildDailyPlannerInputs({ recommendationCatalogFile, plannerProfileFile, progressFile, options = {} }) {
  const catalog = await loadRecommendationCatalog(recommendationCatalogFile);
  const profile = await loadPlannerProfile(plannerProfileFile);
  const progressItems = await loadProgressItems(progressFile);
  const requestSettings = {
    ...profile.settings,
    dailyCount: options.count || profile.settings.dailyCount,
    difficultyPressure: options.difficultyPressure || profile.settings.difficultyPressure,
    targetTags: Array.isArray(options.targetTags) ? options.targetTags : profile.settings.targetTags,
  };
  const practiceProfile = buildPracticeProfile({
    profile: {
      ...profile,
      settings: requestSettings,
    },
    progressItems,
  });
  const candidates = generateCandidates({
    catalogEntries: catalog.entries,
    practiceProfile,
    today: new Date().toISOString(),
  });

  return {
    catalog,
    profile,
    practiceProfile,
    candidates,
  };
}
```

- [ ] **Step 5: Add recommendation and daily plan routes**

Inside the server request handler, before the existing `/api/problems` route block, add:

```js
      if (request.method === "GET" && requestUrl.pathname === "/api/recommendation/catalog") {
        const catalog = await loadRecommendationCatalog(recommendationCatalogFile);
        sendJson(response, 200, { catalog });
        return;
      }

      if (request.method === "POST" && requestUrl.pathname === "/api/recommendation/import") {
        const body = await readJsonBody(request);
        const result = await importRecommendationCatalog(body, recommendationCatalogFile);
        sendJson(response, 200, result);
        return;
      }

      if (request.method === "GET" && requestUrl.pathname === "/api/daily-plan/today") {
        const date = todayDate(requestUrl.searchParams.get("date"));
        const plan = await loadDailyPlan(date, dailyPlanFile);
        sendJson(response, 200, { plan });
        return;
      }

      if (request.method === "POST" && requestUrl.pathname === "/api/daily-plan/generate") {
        const body = await readJsonBody(request);
        const date = todayDate(body.date);
        const { candidates, practiceProfile } = await buildDailyPlannerInputs({
          recommendationCatalogFile,
          plannerProfileFile,
          progressFile,
          options: body,
        });
        const settings = await loadAssistSettings(assistSettingsFile);
        const plan = await generateDailyPlan({
          candidates,
          date,
          count: body.count || practiceProfile.settings.dailyCount,
          planFile: dailyPlanFile,
          settings,
          fetch: assistFetch,
        });
        sendJson(response, 200, { plan, candidateCount: candidates.length });
        return;
      }

      const dailyPlanActionMatch = requestUrl.pathname.match(/^\/api\/daily-plan\/items\/([^/]+)\/action$/);
      if (request.method === "POST" && dailyPlanActionMatch) {
        const slug = decodeURIComponent(dailyPlanActionMatch[1]);
        const body = await readJsonBody(request);
        const date = todayDate(body.date);
        const action = String(body.action || "");
        let plan = await updateDailyPlanItemAction({ planFile: dailyPlanFile, date, slug, action });
        await updatePlannerAction(slug, action, plannerProfileFile);

        if (action === "add_to_practice") {
          const item = plan.items.find((entry) => entry.leetcodeSlug === slug);
          if (item) {
            await saveMemoryPage(memoryPageFromPlanItem(item), memoryFile, currentMemoryFile);
          }
        }

        plan = await loadDailyPlan(date, dailyPlanFile);
        sendJson(response, 200, { plan });
        return;
      }
```

- [ ] **Step 6: Run the API tests and verify they pass**

Run:

```powershell
node --test tests/daily-plan-api.test.js
```

Expected: PASS.

- [ ] **Step 7: Run server regression tests**

Run:

```powershell
node --test tests/server.test.js tests/assist.test.js
```

Expected: PASS.

- [ ] **Step 8: Commit API integration**

Run:

```powershell
git add src/server/server.js tests/daily-plan-api.test.js
git commit -m "feat: expose daily planner APIs"
```

---

### Task 6: Web UI Markup and Styles

**Files:**
- Modify: `web/index.html`
- Modify: `web/styles.css`
- Modify: `tests/web-copy.test.js`

- [ ] **Step 1: Add failing Web UI assertions**

Append to `tests/web-copy.test.js`:

```js
test("web UI exposes daily planner controls", () => {
  const html = fs.readFileSync("web/index.html", "utf8");
  const css = fs.readFileSync("web/styles.css", "utf8");
  const script = fs.readFileSync("web/app.js", "utf8");

  assert.match(html, /id="daily-panel"/);
  assert.match(html, /id="daily-count"/);
  assert.match(html, /id="daily-difficulty"/);
  assert.match(html, /id="daily-tags"/);
  assert.match(html, /id="generate-daily"/);
  assert.match(html, /id="import-catalog"/);
  assert.match(html, /id="catalog-file"/);
  assert.match(html, /id="daily-list"/);
  assert.match(css, /\.daily-panel/);
  assert.match(css, /\.daily-item/);
  assert.match(script, /api\/daily-plan\/generate/);
  assert.match(script, /api\/recommendation\/import/);
  assert.match(script, /renderDailyPlan/);
});
```

- [ ] **Step 2: Run Web UI assertions and verify they fail**

Run:

```powershell
node --test tests/web-copy.test.js
```

Expected: FAIL because daily planner markup and script hooks do not exist.

- [ ] **Step 3: Add Daily Planner markup**

In `web/index.html`, insert this block after `</header>` and before `<div class="content-grid">`:

```html
        <section id="daily-panel" class="daily-panel">
          <div class="daily-head">
            <div>
              <p class="eyebrow">Daily Planner</p>
              <h3>今日刷题</h3>
            </div>
            <div class="daily-actions">
              <button id="import-catalog" type="button" class="secondary">导入推荐题库</button>
              <input id="catalog-file" type="file" accept="application/json,.json" hidden />
              <button id="generate-daily" type="button">生成今日计划</button>
            </div>
          </div>
          <div class="daily-controls">
            <label>
              题量
              <select id="daily-count">
                <option value="3">3 道</option>
                <option value="4">4 道</option>
                <option value="5">5 道</option>
              </select>
            </label>
            <label>
              难度压力
              <select id="daily-difficulty">
                <option value="standard">标准</option>
                <option value="conservative">稳扎稳打</option>
                <option value="intensive">高强度</option>
              </select>
            </label>
            <label>
              目标标签
              <input id="daily-tags" type="text" aria-label="目标标签，使用逗号分隔" />
            </label>
          </div>
          <p id="daily-status" class="daily-status">导入推荐题库后，可以生成今日刷题计划。</p>
          <div id="daily-list" class="daily-list"></div>
        </section>
```

- [ ] **Step 4: Add Daily Planner CSS**

In `web/styles.css`, add this block before the first media query:

```css
.daily-panel {
  display: grid;
  gap: 14px;
  margin-bottom: 20px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--surface);
  padding: 18px;
}

.daily-head,
.daily-actions,
.daily-item-head,
.daily-item-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.daily-actions,
.daily-item-actions {
  flex-wrap: wrap;
}

.daily-controls {
  display: grid;
  grid-template-columns: minmax(90px, 0.5fr) minmax(130px, 0.7fr) minmax(180px, 1fr);
  gap: 10px;
}

.daily-controls label {
  display: grid;
  gap: 7px;
  font-size: 13px;
}

.daily-status {
  color: var(--muted);
  font-size: 13px;
  line-height: 1.5;
}

.daily-list {
  display: grid;
  gap: 10px;
}

.daily-item {
  display: grid;
  gap: 9px;
  border-top: 1px solid var(--line);
  padding-top: 12px;
}

.daily-item h4 {
  font-size: 16px;
}

.daily-item-meta,
.daily-item-reason {
  color: var(--muted);
  font-size: 13px;
  line-height: 1.5;
}

.daily-item-actions a,
.daily-item-actions button {
  padding: 7px 10px;
  font-size: 13px;
}
```

Inside the `@media (max-width: 980px)` block, add:

```css
  .daily-controls {
    grid-template-columns: 1fr;
  }

  .daily-head,
  .daily-item-head {
    align-items: flex-start;
    flex-direction: column;
  }
```

- [ ] **Step 5: Run Web UI assertions**

Run:

```powershell
node --test tests/web-copy.test.js
```

Expected: still FAIL because `web/app.js` hooks are not implemented yet. The markup and CSS assertions should pass.

- [ ] **Step 6: Commit markup and styles**

Run:

```powershell
git add web/index.html web/styles.css tests/web-copy.test.js
git commit -m "feat: add daily planner UI shell"
```

---

### Task 7: Web UI Behavior

**Files:**
- Modify: `web/app.js`
- Test: `tests/web-copy.test.js`

- [ ] **Step 1: Add Daily Planner state and elements**

In `web/app.js`, extend `state`:

```js
  dailyPlan: null,
```

Extend `elements`:

```js
  dailyCount: document.querySelector("#daily-count"),
  dailyDifficulty: document.querySelector("#daily-difficulty"),
  dailyTags: document.querySelector("#daily-tags"),
  generateDaily: document.querySelector("#generate-daily"),
  importCatalog: document.querySelector("#import-catalog"),
  catalogFile: document.querySelector("#catalog-file"),
  dailyStatus: document.querySelector("#daily-status"),
  dailyList: document.querySelector("#daily-list"),
```

- [ ] **Step 2: Add Daily Planner rendering helpers**

Add these functions after `downloadJson`:

```js
function setDailyStatus(message, kind = "") {
  elements.dailyStatus.textContent = message;
  elements.dailyStatus.className = `daily-status ${kind}`.trim();
}

function dailyTagsFromInput() {
  return elements.dailyTags.value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function renderDailyPlan(plan) {
  state.dailyPlan = plan;
  elements.dailyList.innerHTML = "";

  if (!plan?.items?.length) {
    setDailyStatus("还没有今日计划。导入推荐题库后点击生成。");
    return;
  }

  setDailyStatus(`${plan.theme} · ${plan.source === "ai" ? "AI 推荐" : "规则兜底"}`);

  for (const item of plan.items) {
    const row = document.createElement("article");
    row.className = "daily-item";
    row.innerHTML = `
      <div class="daily-item-head">
        <div>
          <h4>${escapeHtml(item.title || item.leetcodeSlug)}</h4>
          <p class="daily-item-meta">${escapeHtml([item.difficulty, ...(item.tags || [])].filter(Boolean).join(" · "))}</p>
        </div>
        <div class="daily-item-actions">
          <a class="link-button" href="${escapeHtml(item.leetcodeUrl)}" target="_blank" rel="noreferrer" data-daily-action="open" data-slug="${escapeHtml(item.leetcodeSlug)}">LeetCode</a>
          <button type="button" data-daily-action="add_to_practice" data-slug="${escapeHtml(item.leetcodeSlug)}">加入练习</button>
          <button type="button" class="secondary" data-daily-action="skip" data-slug="${escapeHtml(item.leetcodeSlug)}">跳过</button>
          <button type="button" class="secondary" data-daily-action="mastered" data-slug="${escapeHtml(item.leetcodeSlug)}">已掌握</button>
        </div>
      </div>
      <p class="daily-item-reason">${escapeHtml(item.reason || "")}</p>
    `;
    elements.dailyList.appendChild(row);
  }
}
```

- [ ] **Step 3: Add catalog import and plan generation functions**

Add after `readJsonFile`:

```js
async function importRecommendationCatalog(file) {
  if (!file) {
    return;
  }

  const payload = await readJsonFile(file);
  const body = await getJson("/api/recommendation/import", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  setDailyStatus(`已导入 ${body.importedCount || 0} 道推荐题。`, "ok");
}

async function loadTodayPlan() {
  const body = await getJson("/api/daily-plan/today");
  renderDailyPlan(body.plan);
}

async function generateDailyPlan() {
  elements.generateDaily.disabled = true;
  setDailyStatus("正在生成今日计划...");

  try {
    const body = await getJson("/api/daily-plan/generate", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        count: Number(elements.dailyCount.value),
        difficultyPressure: elements.dailyDifficulty.value,
        targetTags: dailyTagsFromInput(),
      }),
    });
    renderDailyPlan(body.plan);
  } catch (error) {
    setDailyStatus(error.message, "error");
  } finally {
    elements.generateDaily.disabled = false;
  }
}

async function recordDailyAction(slug, action) {
  const body = await getJson(`/api/daily-plan/items/${encodeURIComponent(slug)}/action`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ action }),
  });
  renderDailyPlan(body.plan);
  if (action === "add_to_practice") {
    await reloadProblems();
  }
}
```

- [ ] **Step 4: Wire Daily Planner events in `init()`**

Inside `init()`, after import problem event wiring, add:

```js
  elements.importCatalog.addEventListener("click", () => {
    elements.catalogFile.click();
  });
  elements.catalogFile.addEventListener("change", () => {
    importRecommendationCatalog(elements.catalogFile.files?.[0])
      .catch((error) => {
        setDailyStatus(error.message, "error");
      })
      .finally(() => {
        elements.catalogFile.value = "";
      });
  });
  elements.generateDaily.addEventListener("click", () => {
    generateDailyPlan();
  });
  elements.dailyList.addEventListener("click", (event) => {
    const target = event.target.closest("[data-daily-action]");
    if (!target) {
      return;
    }
    const slug = target.getAttribute("data-slug");
    const action = target.getAttribute("data-daily-action");
    recordDailyAction(slug, action).catch((error) => setDailyStatus(error.message, "error"));
  });
```

Before `renderProblemList();` near the end of `init()`, add:

```js
  await loadTodayPlan().catch(() => {
    renderDailyPlan(null);
  });
```

- [ ] **Step 5: Run Web UI assertions and verify they pass**

Run:

```powershell
node --test tests/web-copy.test.js
```

Expected: PASS.

- [ ] **Step 6: Run focused API and Web tests together**

Run:

```powershell
node --test tests/daily-plan-api.test.js tests/web-copy.test.js
```

Expected: PASS.

- [ ] **Step 7: Commit Web behavior**

Run:

```powershell
git add web/app.js tests/web-copy.test.js
git commit -m "feat: wire daily planner web workflow"
```

---

### Task 8: Manual Verification and Final Regression

**Files:**
- Modify if needed: files changed in previous tasks only

- [ ] **Step 1: Run all automated tests**

Run:

```powershell
npm test
```

Expected: all tests PASS.

- [ ] **Step 2: Start the local app**

Run:

```powershell
npm start
```

Expected console output:

```text
ACMCoder is running at http://127.0.0.1:43117
```

- [ ] **Step 3: Manually verify fallback daily plan**

Open:

```text
http://127.0.0.1:43117
```

Use a local JSON file with this content for catalog import:

```json
{
  "format": "acmcoder-recommendation-catalog-v1",
  "source": "codetop",
  "entries": [
    {
      "sourceRank": 1,
      "leetcodeSlug": "two-sum",
      "title": "Two Sum",
      "leetcodeUrl": "https://leetcode.cn/problems/two-sum/",
      "difficulty": "easy",
      "tags": ["array", "hash-table"],
      "frequencyScore": 1
    },
    {
      "sourceRank": 2,
      "leetcodeSlug": "lru-cache",
      "title": "LRU Cache",
      "leetcodeUrl": "https://leetcode.cn/problems/lru-cache/",
      "difficulty": "medium",
      "tags": ["hash-table", "linked-list", "design"],
      "frequencyScore": 0.9
    },
    {
      "sourceRank": 3,
      "leetcodeSlug": "merge-k-sorted-lists",
      "title": "Merge k Sorted Lists",
      "leetcodeUrl": "https://leetcode.cn/problems/merge-k-sorted-lists/",
      "difficulty": "hard",
      "tags": ["linked-list", "heap"],
      "frequencyScore": 0.8
    }
  ]
}
```

Expected manual result:

- Import reports 3 recommended problems.
- Generate Daily Plan works without an API key.
- Plan source text shows rule fallback.
- LeetCode link opens the correct problem URL.
- Add to Practice creates a memory problem in the left problem list.
- Existing Run button and runner mode still work for existing seed problems.

- [ ] **Step 4: Verify Docker app assumptions remain valid**

Run:

```powershell
git diff -- Dockerfile Dockerfile.app docker-compose.yml docker-compose.prebuilt.yml
```

Expected: no diff. Daily Planner should not require new Docker packages or runner image changes.

- [ ] **Step 5: Inspect Git status before final handoff**

Run:

```powershell
git status -sb
```

Expected:

```text
## v2.2...origin/v2.2 [ahead N]
?? docs/lesson/
?? output/
```

The exact `ahead N` depends on previous local commits. `docs/lesson/` and `output/` should remain untracked unless the user explicitly asks to include them.

- [ ] **Step 6: Commit final fixes if any were needed**

If Step 1 through Step 4 required small corrections, commit only those corrections:

```powershell
git add <changed-files-from-daily-planner-only>
git commit -m "fix: stabilize daily planner workflow"
```

If no corrections were needed after previous task commits, skip this commit.

---

## Spec Coverage Check

- Recommendation catalog: Task 1.
- User practice profile: Task 2.
- Candidate generator: Task 3.
- AI daily planner and fallback: Task 4.
- Daily plan persistence: Task 4.
- API contracts: Task 5.
- Add to My Practice: Task 5 and Task 7.
- Web UI: Task 6 and Task 7.
- Existing runner isolation: Task 8.
- Failure modes: Task 4 and Task 5.
- Tests: every implementation task includes focused tests, and Task 8 runs full regression.

## Execution Notes

- Keep commits small and task-bound.
- Do not stage `docs/lesson/` or `output/`.
- Do not push to GitHub.
- Do not add new runtime dependencies.
- Do not introduce live CodeTop scraping in this implementation pass.

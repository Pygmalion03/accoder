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

test("skips invalid catalog entries and limits normalized candidates", () => {
  const candidates = generateCandidates({
    catalogEntries: [
      { title: "Missing Slug", leetcodeUrl: "https://leetcode.cn/problems/missing-slug/" },
      { leetcodeSlug: "missing-url", title: "Missing URL" },
      {
        leetcodeSlug: "valid-hard",
        title: "Valid Hard",
        leetcodeUrl: "https://leetcode.cn/problems/valid-hard/",
        difficulty: "Hard",
        tags: "heap",
        frequencyScore: 2,
        sourceRank: -1,
      },
      {
        leetcodeSlug: "valid-easy",
        title: "Valid Easy",
        leetcodeUrl: "https://leetcode.cn/problems/valid-easy/",
        difficulty: "Easy",
        tags: ["array"],
        frequencyScore: -2,
        sourceRank: 5.8,
      },
    ],
    limit: 1,
  });

  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].leetcodeSlug, "valid-hard");
  assert.equal(candidates[0].difficulty, "hard");
  assert.deepEqual(candidates[0].tags, []);
  assert.equal(candidates[0].frequencyScore, 1);
  assert.equal(candidates[0].sourceRank, Number.MAX_SAFE_INTEGER);
});

test("applies configured difficulty pressure weights", () => {
  const pressureCatalog = [
    {
      leetcodeSlug: "easy-one",
      title: "Easy One",
      leetcodeUrl: "https://leetcode.cn/problems/easy-one/",
      difficulty: "easy",
      frequencyScore: 0,
      sourceRank: 1,
    },
    {
      leetcodeSlug: "medium-one",
      title: "Medium One",
      leetcodeUrl: "https://leetcode.cn/problems/medium-one/",
      difficulty: "medium",
      frequencyScore: 0,
      sourceRank: 2,
    },
    {
      leetcodeSlug: "hard-one",
      title: "Hard One",
      leetcodeUrl: "https://leetcode.cn/problems/hard-one/",
      difficulty: "hard",
      frequencyScore: 0,
      sourceRank: 3,
    },
  ];

  assert.equal(
    generateCandidates({
      catalogEntries: pressureCatalog,
      practiceProfile: { settings: { difficultyPressure: "conservative" } },
    })[0].leetcodeSlug,
    "easy-one",
  );
  assert.equal(
    generateCandidates({
      catalogEntries: pressureCatalog,
      practiceProfile: { settings: { difficultyPressure: "standard" } },
    })[0].leetcodeSlug,
    "medium-one",
  );
  assert.equal(
    generateCandidates({
      catalogEntries: pressureCatalog,
      practiceProfile: { settings: { difficultyPressure: "intensive" } },
    })[0].leetcodeSlug,
    "hard-one",
  );
});

test("uses source rank and slug for deterministic ties", () => {
  const tiedCandidates = generateCandidates({
    catalogEntries: [
      {
        leetcodeSlug: "b-problem",
        title: "B Problem",
        leetcodeUrl: "https://leetcode.cn/problems/b-problem/",
        difficulty: "medium",
        frequencyScore: 0.5,
        sourceRank: 1,
      },
      {
        leetcodeSlug: "c-problem",
        title: "C Problem",
        leetcodeUrl: "https://leetcode.cn/problems/c-problem/",
        difficulty: "medium",
        frequencyScore: 0.5,
        sourceRank: 2,
      },
      {
        leetcodeSlug: "a-problem",
        title: "A Problem",
        leetcodeUrl: "https://leetcode.cn/problems/a-problem/",
        difficulty: "medium",
        frequencyScore: 0.5,
        sourceRank: 1,
      },
    ],
  });

  assert.deepEqual(
    tiedCandidates.map((candidate) => candidate.leetcodeSlug),
    ["a-problem", "b-problem", "c-problem"],
  );
});

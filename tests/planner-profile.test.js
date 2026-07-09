import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { buildPracticeProfile, loadPlannerProfile, updatePlannerAction } from "../src/server/planner-profile.js";

async function tempProfileFile(name = "profile.json") {
  return path.join(await fs.mkdtemp(path.join(os.tmpdir(), "acmcoder-profile-")), name);
}

test("loads default planner profile settings when no profile exists", async () => {
  const profileFile = await tempProfileFile();
  const profile = await loadPlannerProfile(profileFile);

  assert.equal(profile.version, 1);
  assert.equal(profile.settings.dailyCount, 3);
  assert.equal(profile.settings.difficultyPressure, "standard");
  assert.equal(profile.settings.cooldownDays, 3);
  assert.deepEqual(profile.items, {});
});

test("records planner item actions by slug", async () => {
  const profileFile = await tempProfileFile();

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

test("normalizes saved settings and planner item slugs", async () => {
  const profileFile = await tempProfileFile();
  await fs.writeFile(
    profileFile,
    JSON.stringify({
      version: 1,
      settings: {
        dailyCount: 20,
        difficultyPressure: "reckless",
        cooldownDays: -4,
        targetTags: ["dp", " ", "array", "dp", 3],
      },
      items: {
        "memory:two-sum": {
          openedAt: "2026-07-09T08:00:00.000Z",
          wantPracticeAgain: true,
        },
      },
    }),
    "utf8",
  );

  const profile = await loadPlannerProfile(profileFile);

  assert.equal(profile.settings.dailyCount, 5);
  assert.equal(profile.settings.difficultyPressure, "standard");
  assert.equal(profile.settings.cooldownDays, 3);
  assert.deepEqual(profile.settings.targetTags, ["dp", "array"]);
  assert.equal(profile.items["two-sum"].leetcodeSlug, "two-sum");
  assert.equal(profile.items["two-sum"].openedAt, "2026-07-09T08:00:00.000Z");
});

test("uses defaults for blank settings and falls back to item keys for blank item slugs", async () => {
  const profileFile = await tempProfileFile();
  await fs.writeFile(
    profileFile,
    JSON.stringify({
      version: 1,
      settings: {
        dailyCount: "",
        cooldownDays: null,
      },
      items: {
        "memory:two-sum": {
          leetcodeSlug: " ",
          skippedAt: "2026-07-09T08:00:00.000Z",
        },
      },
    }),
    "utf8",
  );

  const profile = await loadPlannerProfile(profileFile);

  assert.equal(profile.settings.dailyCount, 3);
  assert.equal(profile.settings.cooldownDays, 3);
  assert.equal(profile.items["two-sum"].leetcodeSlug, "two-sum");
  assert.equal(profile.items["two-sum"].skippedAt, "2026-07-09T08:00:00.000Z");
});

test("rejects missing slugs and unsupported planner actions", async () => {
  const profileFile = await tempProfileFile();

  await assert.rejects(
    () => updatePlannerAction(" ", "skip", profileFile, "2026-07-09T12:00:00.000Z"),
    /Missing planner action slug\./,
  );
  await assert.rejects(
    () => updatePlannerAction("two-sum", "archive", profileFile, "2026-07-09T12:00:00.000Z"),
    /Unsupported planner action: archive/,
  );
});

test("merges memory-prefixed and progress-only items into practice profile", () => {
  const merged = buildPracticeProfile({
    profile: {
      version: 1,
      settings: { dailyCount: "1", difficultyPressure: "intensive", cooldownDays: 0, targetTags: ["array"] },
      items: {
        "memory:two-sum": {
          leetcodeSlug: "memory:two-sum",
          openedAt: "2026-07-09T08:00:00.000Z",
        },
      },
    },
    progressItems: {
      "memory:two-sum": {
        slug: "memory:two-sum",
        acCount: 2,
        lastAcceptedAt: "2026-07-09T09:00:00.000Z",
      },
      "binary-search": {
        slug: " ",
        acCount: 1,
        lastAcceptedAt: "2026-07-09T10:00:00.000Z",
      },
    },
  });

  assert.equal(merged.items["two-sum"].leetcodeSlug, "two-sum");
  assert.equal(merged.items["two-sum"].acceptedCount, 2);
  assert.equal(merged.items["binary-search"].acceptedCount, 1);
  assert.equal(merged.items["binary-search"].lastPracticedAt, "2026-07-09T10:00:00.000Z");
  assert.equal(merged.items["binary-search"].wantPracticeAgain, false);
});

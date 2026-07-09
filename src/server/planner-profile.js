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
const difficultyPressures = new Set(["conservative", "standard", "intensive"]);

export function getDefaultPlannerProfileFile() {
  return defaultPlannerProfileFile;
}

function normalizePlannerSlug(slug) {
  return String(slug ?? "").trim().replace(/^memory:/, "").trim();
}

function isBlankValue(value) {
  return value === null || value === undefined || (typeof value === "string" && value.trim() === "");
}

function normalizeDailyCount(dailyCount) {
  if (isBlankValue(dailyCount)) {
    return defaultSettings.dailyCount;
  }

  const count = Math.floor(Number(dailyCount));
  if (!Number.isFinite(count)) {
    return defaultSettings.dailyCount;
  }

  return Math.min(5, Math.max(1, count));
}

function normalizeCooldownDays(cooldownDays) {
  if (isBlankValue(cooldownDays)) {
    return defaultSettings.cooldownDays;
  }

  const days = Math.floor(Number(cooldownDays));
  if (!Number.isFinite(days) || days < 0) {
    return defaultSettings.cooldownDays;
  }

  return days;
}

function normalizeDifficultyPressure(difficultyPressure) {
  const pressure = String(difficultyPressure ?? "").trim().toLowerCase();
  return difficultyPressures.has(pressure) ? pressure : defaultSettings.difficultyPressure;
}

function normalizeTargetTags(targetTags) {
  if (!Array.isArray(targetTags)) {
    return [];
  }

  const seen = new Set();
  const normalized = [];

  for (const tag of targetTags) {
    if (typeof tag !== "string") {
      continue;
    }

    const value = tag.trim();
    if (!value || seen.has(value)) {
      continue;
    }

    seen.add(value);
    normalized.push(value);
  }

  return normalized;
}

function normalizeSettings(settings = {}) {
  return {
    dailyCount: normalizeDailyCount(settings?.dailyCount),
    difficultyPressure: normalizeDifficultyPressure(settings?.difficultyPressure),
    cooldownDays: normalizeCooldownDays(settings?.cooldownDays),
    targetTags: normalizeTargetTags(settings?.targetTags),
  };
}

function stringField(value) {
  return typeof value === "string" ? value : "";
}

function emptyPlannerItem(slug) {
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

function normalizePlannerItem(slug, item = {}) {
  const leetcodeSlug = normalizePlannerSlug(item?.leetcodeSlug) || normalizePlannerSlug(slug);
  if (!leetcodeSlug) {
    return null;
  }

  return {
    ...emptyPlannerItem(leetcodeSlug),
    openedAt: stringField(item?.openedAt),
    addedToPracticeAt: stringField(item?.addedToPracticeAt),
    skippedAt: stringField(item?.skippedAt),
    masteredAt: stringField(item?.masteredAt),
    wantPracticeAgain: item?.wantPracticeAgain === true,
    updatedAt: stringField(item?.updatedAt),
  };
}

function normalizePlannerProfile(profile = {}) {
  const rawItems = profile?.items && typeof profile.items === "object" ? profile.items : {};
  const items = {};

  for (const [slug, item] of Object.entries(rawItems)) {
    const normalized = normalizePlannerItem(slug, item);
    if (normalized) {
      items[normalized.leetcodeSlug] = normalized;
    }
  }

  return {
    version: 1,
    settings: normalizeSettings(profile?.settings),
    items,
  };
}

async function savePlannerProfile(profile, profileFile = defaultPlannerProfileFile) {
  await fs.mkdir(path.dirname(profileFile), { recursive: true });
  await fs.writeFile(profileFile, JSON.stringify(profile, null, 2), "utf8");
}

export async function loadPlannerProfile(profileFile = defaultPlannerProfileFile) {
  try {
    return normalizePlannerProfile(JSON.parse(await fs.readFile(profileFile, "utf8")));
  } catch (error) {
    if (error.code === "ENOENT") {
      return normalizePlannerProfile();
    }

    throw error;
  }
}

export async function updatePlannerAction(
  slug,
  action,
  profileFile = defaultPlannerProfileFile,
  timestamp = new Date().toISOString(),
) {
  const key = normalizePlannerSlug(slug);
  if (!key) {
    throw new Error("Missing planner action slug.");
  }

  const profile = await loadPlannerProfile(profileFile);
  const nextItem = {
    ...emptyPlannerItem(key),
    ...profile.items[key],
    leetcodeSlug: key,
    updatedAt: String(timestamp),
  };

  switch (action) {
    case "open":
      nextItem.openedAt = String(timestamp);
      break;
    case "add_to_practice":
      nextItem.addedToPracticeAt = String(timestamp);
      break;
    case "skip":
      nextItem.skippedAt = String(timestamp);
      break;
    case "mastered":
      nextItem.masteredAt = String(timestamp);
      nextItem.wantPracticeAgain = false;
      break;
    case "want_practice_again":
      nextItem.masteredAt = "";
      nextItem.wantPracticeAgain = true;
      break;
    default:
      throw new Error(`Unsupported planner action: ${action}`);
  }

  profile.items[key] = nextItem;
  await savePlannerProfile(profile, profileFile);
  return profile;
}

function normalizeAcceptedCount(acCount) {
  const count = Math.floor(Number(acCount ?? 0));
  if (!Number.isFinite(count) || count < 0) {
    return 0;
  }

  return count;
}

function withPracticeFields(item) {
  return {
    ...item,
    acceptedCount: 0,
    lastPracticedAt: "",
  };
}

export function buildPracticeProfile({ profile, progressItems } = {}) {
  const normalizedProfile = normalizePlannerProfile(profile);
  const items = {};

  for (const [slug, item] of Object.entries(normalizedProfile.items)) {
    items[slug] = withPracticeFields(item);
  }

  const rawProgressItems = progressItems && typeof progressItems === "object" ? progressItems : {};
  for (const [slug, progress] of Object.entries(rawProgressItems)) {
    const key = normalizePlannerSlug(progress?.slug) || normalizePlannerSlug(slug);
    if (!key) {
      continue;
    }

    items[key] = {
      ...withPracticeFields(normalizePlannerItem(key, items[key] || {})),
      acceptedCount: normalizeAcceptedCount(progress?.acCount),
      lastPracticedAt: stringField(progress?.lastAcceptedAt),
    };
  }

  return {
    version: 1,
    settings: normalizedProfile.settings,
    items,
  };
}

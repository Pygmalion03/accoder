import fs from "node:fs/promises";
import path from "node:path";

import { projectRoot } from "../core/problems.js";

const defaultRecommendationCatalogFile = path.join(projectRoot, "data", "recommendation", "catalog.json");
const difficultyMap = new Map([
  ["简单", "easy"],
  ["中等", "medium"],
  ["困难", "hard"],
]);

export function getDefaultRecommendationCatalogFile() {
  return defaultRecommendationCatalogFile;
}

function firstValue(...values) {
  for (const value of values) {
    const normalized = String(value ?? "").trim();
    if (normalized) {
      return normalized;
    }
  }

  return "";
}

function normalizeDifficulty(difficulty) {
  const normalized = String(difficulty ?? "").trim().toLowerCase();
  return difficultyMap.get(normalized) || normalized;
}

function normalizeTags(tags = []) {
  if (!Array.isArray(tags)) {
    return [];
  }

  const seen = new Set();
  const normalizedTags = [];

  for (const tag of tags) {
    if (typeof tag !== "string") {
      continue;
    }

    const normalized = tag.trim();
    if (!normalized || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    normalizedTags.push(normalized);
  }

  return normalizedTags;
}

function normalizeFrequencyScore(frequencyScore) {
  const score = Number(frequencyScore ?? 0);
  if (!Number.isFinite(score)) {
    return 0;
  }

  return Math.min(1, Math.max(0, score));
}

function normalizeSourceRank(sourceRank) {
  const rank = Math.floor(Number(sourceRank ?? 0));
  if (!Number.isFinite(rank)) {
    return 0;
  }

  return Math.max(0, rank);
}

function catalogSort(a, b) {
  return (
    b.frequencyScore - a.frequencyScore ||
    a.sourceRank - b.sourceRank ||
    a.leetcodeSlug.localeCompare(b.leetcodeSlug)
  );
}

function entriesFromPayload(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (Array.isArray(payload?.entries)) {
    return payload.entries;
  }

  if (Array.isArray(payload?.problems)) {
    return payload.problems;
  }

  return [];
}

export function normalizeCatalogEntry(entry, source = "", syncedAt = new Date().toISOString()) {
  const leetcodeSlug = firstValue(entry?.leetcodeSlug, entry?.slug, entry?.leetcode?.slug);
  if (!leetcodeSlug) {
    throw new Error("Missing recommendation slug.");
  }

  const leetcodeUrl = firstValue(entry?.leetcodeUrl, entry?.url, entry?.leetcode?.url);
  if (!leetcodeUrl) {
    throw new Error(`Missing LeetCode URL for recommendation: ${leetcodeSlug}`);
  }

  return {
    source: String(source || "").trim(),
    sourceRank: normalizeSourceRank(entry?.sourceRank),
    leetcodeSlug,
    title: String(entry?.title ?? "").trim(),
    leetcodeUrl,
    difficulty: normalizeDifficulty(entry?.difficulty),
    tags: normalizeTags(entry?.tags),
    frequencyScore: normalizeFrequencyScore(entry?.frequencyScore),
    lastSyncedAt: syncedAt,
  };
}

export async function loadRecommendationCatalog(catalogFile = defaultRecommendationCatalogFile) {
  try {
    const catalog = JSON.parse(await fs.readFile(catalogFile, "utf8"));
    return {
      version: 1,
      importedAt: String(catalog?.importedAt ?? ""),
      entries: Array.isArray(catalog?.entries) ? catalog.entries : [],
    };
  } catch (error) {
    if (error.code === "ENOENT") {
      return { version: 1, importedAt: "", entries: [] };
    }

    throw error;
  }
}

export async function importRecommendationCatalog(
  payload,
  catalogFile = defaultRecommendationCatalogFile,
  importedAt = new Date().toISOString(),
) {
  const payloadSource = Array.isArray(payload) ? "" : payload?.source;
  const normalizedEntries = entriesFromPayload(payload).map((entry) =>
    normalizeCatalogEntry(entry, entry?.source || payloadSource, importedAt),
  );
  const entriesBySlug = new Map();

  for (const entry of normalizedEntries.sort(catalogSort)) {
    if (!entriesBySlug.has(entry.leetcodeSlug)) {
      entriesBySlug.set(entry.leetcodeSlug, entry);
    }
  }

  const catalog = {
    version: 1,
    importedAt,
    entries: [...entriesBySlug.values()].sort(catalogSort),
  };

  await fs.mkdir(path.dirname(catalogFile), { recursive: true });
  await fs.writeFile(catalogFile, JSON.stringify(catalog, null, 2), "utf8");

  return {
    importedCount: catalog.entries.length,
    catalog,
  };
}

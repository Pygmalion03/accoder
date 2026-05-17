import fs from "node:fs/promises";
import path from "node:path";

import { projectRoot } from "../core/problems.js";

const defaultProgressFile = path.join(projectRoot, "data", "memory", "progress.json");

export function getDefaultProgressFile() {
  return defaultProgressFile;
}

export function progressKeyForSlug(slug) {
  const value = String(slug || "").trim();
  if (!value || value === "scratch") {
    return "";
  }
  return value.replace(/^memory:/, "");
}

function normalizeProgress(slug, progress = {}) {
  const key = progressKeyForSlug(slug || progress.slug);
  const acCount = Math.max(0, Math.floor(Number(progress.acCount || 0)));
  const lastAcceptedAt = typeof progress.lastAcceptedAt === "string" ? progress.lastAcceptedAt : "";
  return {
    slug: key,
    acCount: Number.isFinite(acCount) ? acCount : 0,
    lastAcceptedAt,
  };
}

export function emptyProgress(slug) {
  return normalizeProgress(slug);
}

export async function loadProgressItems(progressFile = defaultProgressFile) {
  try {
    const body = JSON.parse(await fs.readFile(progressFile, "utf8"));
    const rawItems = body?.items && typeof body.items === "object" ? body.items : {};
    const items = {};

    for (const [slug, progress] of Object.entries(rawItems)) {
      const normalized = normalizeProgress(slug, progress);
      if (normalized.slug) {
        items[normalized.slug] = normalized;
      }
    }

    return items;
  } catch (error) {
    if (error.code === "ENOENT") {
      return {};
    }
    throw error;
  }
}

async function saveProgressItems(items, progressFile = defaultProgressFile) {
  await fs.mkdir(path.dirname(progressFile), { recursive: true });
  await fs.writeFile(progressFile, JSON.stringify({ version: 1, items }, null, 2), "utf8");
}

export function progressForSlug(slug, items = {}) {
  const key = progressKeyForSlug(slug);
  if (!key) {
    return emptyProgress(slug);
  }
  return normalizeProgress(key, items[key] || {});
}

export function withProblemProgress(problem, items = {}) {
  return {
    ...problem,
    progress: progressForSlug(problem.slug, items),
  };
}

export function withPageProgress(page, items = {}) {
  return {
    ...page,
    progress: progressForSlug(page.slug, items),
  };
}

export async function recordAcceptedProgress(slug, progressFile = defaultProgressFile, acceptedAt = new Date().toISOString()) {
  const key = progressKeyForSlug(slug);
  if (!key) {
    return emptyProgress(slug);
  }

  const items = await loadProgressItems(progressFile);
  const current = progressForSlug(key, items);
  const next = {
    slug: key,
    acCount: current.acCount + 1,
    lastAcceptedAt: acceptedAt,
  };
  items[key] = next;
  await saveProgressItems(items, progressFile);
  return next;
}

export async function mergeProgressEntries(entries = [], progressFile = defaultProgressFile) {
  const items = await loadProgressItems(progressFile);
  let importedProgressCount = 0;
  let changed = false;

  for (const entry of entries) {
    const key = progressKeyForSlug(entry?.slug);
    if (!key) {
      continue;
    }

    const incoming = normalizeProgress(key, entry.progress);
    const current = progressForSlug(key, items);
    const shouldUpdateCount = incoming.acCount > current.acCount;
    const shouldUpdateTime =
      incoming.lastAcceptedAt && (!current.lastAcceptedAt || Date.parse(incoming.lastAcceptedAt) > Date.parse(current.lastAcceptedAt));

    if (!shouldUpdateCount && !shouldUpdateTime) {
      continue;
    }

    items[key] = {
      slug: key,
      acCount: shouldUpdateCount ? incoming.acCount : current.acCount,
      lastAcceptedAt: shouldUpdateTime ? incoming.lastAcceptedAt : current.lastAcceptedAt,
    };
    changed = true;

    if (shouldUpdateCount) {
      importedProgressCount += 1;
    }
  }

  if (changed) {
    await saveProgressItems(items, progressFile);
  }

  return { importedProgressCount };
}

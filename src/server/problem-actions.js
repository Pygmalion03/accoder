import fs from "node:fs/promises";
import path from "node:path";

import { projectRoot } from "../core/problems.js";
import { deleteMemoryPages, exportMemoryPages, saveMemoryPage } from "./memory.js";
import { loadProgressItems, mergeProgressEntries, progressForSlug } from "./progress.js";

const defaultDeletedProblemsFile = path.join(projectRoot, "data", "memory", "deleted-problems.json");

export function getDefaultDeletedProblemsFile() {
  return defaultDeletedProblemsFile;
}

function normalizeSlugs(slugs = []) {
  return Array.from(new Set(slugs.map((slug) => String(slug).trim()).filter(Boolean)));
}

function stripMemoryPrefix(slug) {
  return String(slug).replace(/^memory:/, "");
}

export async function loadDeletedProblemSlugs(deletedProblemsFile = defaultDeletedProblemsFile) {
  try {
    const body = JSON.parse(await fs.readFile(deletedProblemsFile, "utf8"));
    return new Set(Array.isArray(body.slugs) ? body.slugs.map(String).filter(Boolean) : []);
  } catch (error) {
    if (error.code === "ENOENT") {
      return new Set();
    }
    throw error;
  }
}

async function saveDeletedProblemSlugs(slugs, deletedProblemsFile = defaultDeletedProblemsFile) {
  await fs.mkdir(path.dirname(deletedProblemsFile), { recursive: true });
  await fs.writeFile(deletedProblemsFile, JSON.stringify({ slugs: [...slugs].sort() }, null, 2), "utf8");
}

export function filterVisibleProblems(problems, deletedSlugs) {
  return problems.filter((problem) => !deletedSlugs.has(problem.slug));
}

function memoryProblemFromPage(page) {
  return {
    source: "memory",
    slug: `memory:${page.slug}`,
    frontendId: page.frontendId || page.questionFrontendId || "",
    title: page.title || page.slug,
    difficulty: String(page.difficulty || "").toLowerCase(),
    tags: Array.isArray(page.tags) ? page.tags : [],
    sample: page.sample || null,
    rank: {
      source: "local-memory",
      frequency: 0,
      updatedAt: page.capturedAt,
    },
    leetcode: {
      slug: page.slug,
      url: page.url,
    },
    description: page.content || "",
    cases: [],
  };
}

export async function deleteProblems({ slugs = [], problems = [], memoryFile, currentMemoryFile, deletedProblemsFile } = {}) {
  const normalizedSlugs = normalizeSlugs(slugs);
  if (normalizedSlugs.length === 0) {
    throw new Error("Missing problem slugs.");
  }

  const seedSlugs = new Set(problems.map((problem) => problem.slug));
  const hiddenSlugs = await loadDeletedProblemSlugs(deletedProblemsFile);
  const seedDeletes = normalizedSlugs.filter((slug) => seedSlugs.has(slug));
  const memoryDeletes = normalizedSlugs.filter((slug) => slug.startsWith("memory:")).map(stripMemoryPrefix);
  const deletedSlugs = [];

  for (const slug of seedDeletes) {
    hiddenSlugs.add(slug);
    deletedSlugs.push(slug);
  }

  if (seedDeletes.length > 0) {
    await saveDeletedProblemSlugs(hiddenSlugs, deletedProblemsFile);
  }

  if (memoryDeletes.length > 0) {
    const result = await deleteMemoryPages({ slugs: memoryDeletes }, memoryFile, currentMemoryFile);
    deletedSlugs.push(...result.deletedSlugs.map((slug) => `memory:${slug}`));
  }

  return { deletedSlugs };
}

export async function exportProblems({ slugs = [], problems = [], memoryFile, deletedProblemsFile, progressFile } = {}) {
  const normalizedSlugs = normalizeSlugs(slugs);
  const requested = normalizedSlugs.length > 0 ? new Set(normalizedSlugs) : null;
  const deletedSlugs = await loadDeletedProblemSlugs(deletedProblemsFile);
  const progressItems = await loadProgressItems(progressFile);
  const visibleSeedProblems = filterVisibleProblems(problems, deletedSlugs)
    .filter((problem) => !requested || requested.has(problem.slug))
    .map((problem) => ({ source: "seed", ...problem, progress: progressForSlug(problem.slug, progressItems) }));
  const memorySlugs = requested ? normalizedSlugs.filter((slug) => slug.startsWith("memory:")).map(stripMemoryPrefix) : [];
  const memoryExport = await exportMemoryPages({ slugs: memorySlugs }, memoryFile);
  const memoryProblems = memoryExport.pages
    .map(memoryProblemFromPage)
    .filter((problem) => !requested || requested.has(problem.slug))
    .map((problem) => ({ ...problem, progress: progressForSlug(problem.slug, progressItems) }));

  return {
    format: "acmcoder-problems-v1",
    exportedAt: new Date().toISOString(),
    problems: [...visibleSeedProblems, ...memoryProblems],
  };
}

function memoryPageFromProblem(problem) {
  const slug = stripMemoryPrefix(problem.slug || problem.leetcode?.slug || "");
  return {
    source: "leetcode",
    url: problem.leetcode?.url || "",
    slug,
    frontendId: problem.frontendId || "",
    title: problem.title || slug,
    difficulty: problem.difficulty || "",
    tags: Array.isArray(problem.tags) ? problem.tags : [],
    sample: problem.sample || null,
    content: problem.description || problem.content || problem.title || slug,
    capturedAt: problem.rank?.updatedAt || problem.capturedAt || new Date().toISOString(),
  };
}

function importedPagesFromPayload(payload) {
  if (payload?.format === "acmcoder-memory-v1") {
    return Array.isArray(payload.pages) ? payload.pages : [];
  }

  if (payload?.format === "acmcoder-problems-v1") {
    return Array.isArray(payload.problems)
      ? payload.problems
          .filter((problem) => problem?.source === "memory" || String(problem?.slug || "").startsWith("memory:"))
          .map(memoryPageFromProblem)
      : [];
  }

  throw new Error("Unsupported import format.");
}

function importedSeedSlugsFromPayload(payload, problems = []) {
  if (payload?.format !== "acmcoder-problems-v1") {
    return [];
  }

  const seedSlugs = new Set(problems.map((problem) => problem.slug));
  return normalizeSlugs(
    (Array.isArray(payload.problems) ? payload.problems : [])
      .filter((problem) => problem?.source === "seed" || seedSlugs.has(problem?.slug))
      .map((problem) => problem.slug)
      .filter((slug) => seedSlugs.has(slug)),
  );
}

function importedProgressEntriesFromPayload(payload) {
  if (payload?.format === "acmcoder-memory-v1") {
    return Array.isArray(payload.pages)
      ? payload.pages.map((page) => ({ slug: page?.slug, progress: page?.progress })).filter((entry) => entry.progress)
      : [];
  }

  if (payload?.format === "acmcoder-problems-v1") {
    return Array.isArray(payload.problems)
      ? payload.problems
          .map((problem) => ({ slug: problem?.slug || problem?.leetcode?.slug, progress: problem?.progress }))
          .filter((entry) => entry.progress)
      : [];
  }

  return [];
}

export async function importProblems({ payload, problems = [], memoryFile, currentMemoryFile, deletedProblemsFile, progressFile } = {}) {
  const hiddenSlugs = await loadDeletedProblemSlugs(deletedProblemsFile);
  const seedSlugs = importedSeedSlugsFromPayload(payload, problems);
  const restoredSeedSlugs = [];

  for (const slug of seedSlugs) {
    if (hiddenSlugs.delete(slug)) {
      restoredSeedSlugs.push(slug);
    }
  }

  if (seedSlugs.length > 0) {
    await saveDeletedProblemSlugs(hiddenSlugs, deletedProblemsFile);
  }

  const pages = importedPagesFromPayload(payload);
  const importedMemorySlugs = [];

  for (const page of pages) {
    const imported = await saveMemoryPage(page, memoryFile, currentMemoryFile);
    importedMemorySlugs.push(imported.slug);
  }

  const { importedProgressCount } = await mergeProgressEntries(importedProgressEntriesFromPayload(payload), progressFile);

  return {
    importedCount: restoredSeedSlugs.length + importedMemorySlugs.length,
    restoredSeedSlugs,
    importedMemorySlugs,
    importedProgressCount,
  };
}

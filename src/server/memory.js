import fs from "node:fs/promises";
import path from "node:path";

import { projectRoot } from "../core/problems.js";

const defaultMemoryFile = path.join(projectRoot, "data", "memory", "pages.jsonl");
const defaultCurrentMemoryFile = path.join(projectRoot, "data", "memory", "current.json");

export function getDefaultMemoryFile() {
  return defaultMemoryFile;
}

export function getDefaultCurrentMemoryFile() {
  return defaultCurrentMemoryFile;
}

function sanitizePage(body) {
  const page = {
    source: String(body.source || "leetcode"),
    url: String(body.url || ""),
    slug: String(body.slug || ""),
    frontendId: String(body.frontendId || body.questionFrontendId || ""),
    title: String(body.title || ""),
    difficulty: String(body.difficulty || ""),
    tags: Array.isArray(body.tags) ? body.tags.map(String).filter(Boolean) : [],
    sample:
      body.sample && typeof body.sample === "object"
        ? {
            inputText: String(body.sample.inputText || ""),
            outputText: String(body.sample.outputText || ""),
          }
        : null,
    content: String(body.content || ""),
    capturedAt: body.capturedAt || new Date().toISOString(),
  };

  if (!page.url) {
    throw new Error("Missing memory page url.");
  }

  if (!page.slug) {
    throw new Error("Missing memory page slug.");
  }

  if (!page.content.trim()) {
    throw new Error("Missing memory page content.");
  }

  return page;
}

export async function saveMemoryPage(body, memoryFile = defaultMemoryFile, currentMemoryFile = defaultCurrentMemoryFile) {
  const page = sanitizePage(body);
  await fs.mkdir(path.dirname(memoryFile), { recursive: true });
  await fs.appendFile(memoryFile, `${JSON.stringify(page)}\n`, "utf8");
  await fs.mkdir(path.dirname(currentMemoryFile), { recursive: true });
  await fs.writeFile(currentMemoryFile, JSON.stringify(page, null, 2), "utf8");
  return page;
}

async function writeMemoryPages(pages, memoryFile = defaultMemoryFile) {
  await fs.mkdir(path.dirname(memoryFile), { recursive: true });
  const content = pages.map((page) => JSON.stringify(page)).join("\n");
  await fs.writeFile(memoryFile, content ? `${content}\n` : "", "utf8");
}

function normalizeSlugs(slugs = []) {
  return Array.from(new Set(slugs.map((slug) => String(slug).trim()).filter(Boolean)));
}

function latestPagesBySlug(pages = []) {
  const latest = new Map();

  for (const page of pages) {
    if (!page?.slug) {
      continue;
    }

    const existing = latest.get(page.slug);
    const existingTime = Date.parse(existing?.capturedAt || 0);
    const nextTime = Date.parse(page.capturedAt || 0);
    if (!existing || nextTime >= existingTime) {
      latest.set(page.slug, page);
    }
  }

  return [...latest.values()].sort((a, b) => Date.parse(b.capturedAt || 0) - Date.parse(a.capturedAt || 0));
}

export async function loadMemoryPages({ slug } = {}, memoryFile = defaultMemoryFile) {
  try {
    const text = await fs.readFile(memoryFile, "utf8");
    return text
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line))
      .filter((page) => !slug || page.slug === slug);
  } catch (error) {
    if (error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

export async function deleteMemoryPages({ slugs = [] } = {}, memoryFile = defaultMemoryFile, currentMemoryFile = defaultCurrentMemoryFile) {
  const normalizedSlugs = normalizeSlugs(slugs);
  if (normalizedSlugs.length === 0) {
    throw new Error("Missing memory page slugs.");
  }

  const slugSet = new Set(normalizedSlugs);
  const pages = await loadMemoryPages({}, memoryFile);
  const deletedSlugSet = new Set();
  const remainingPages = pages.filter((page) => {
    if (slugSet.has(page.slug)) {
      deletedSlugSet.add(page.slug);
      return false;
    }
    return true;
  });

  await writeMemoryPages(remainingPages, memoryFile);

  const currentPage = await loadCurrentMemoryPage(currentMemoryFile);
  if (currentPage?.slug && slugSet.has(currentPage.slug)) {
    if (remainingPages.length > 0) {
      await fs.mkdir(path.dirname(currentMemoryFile), { recursive: true });
      await fs.writeFile(currentMemoryFile, JSON.stringify(remainingPages.at(-1), null, 2), "utf8");
    } else {
      await fs.rm(currentMemoryFile, { force: true });
    }
  }

  return {
    deletedSlugs: normalizedSlugs.filter((slug) => deletedSlugSet.has(slug)),
    pages: remainingPages,
  };
}

export async function exportMemoryPages({ slugs = [] } = {}, memoryFile = defaultMemoryFile) {
  const normalizedSlugs = normalizeSlugs(slugs);
  const slugSet = normalizedSlugs.length > 0 ? new Set(normalizedSlugs) : null;
  const pages = await loadMemoryPages({}, memoryFile);
  const filteredPages = slugSet ? pages.filter((page) => slugSet.has(page.slug)) : pages;

  return {
    format: "accoder-memory-v1",
    exportedAt: new Date().toISOString(),
    pages: latestPagesBySlug(filteredPages),
  };
}

export async function loadCurrentMemoryPage(currentMemoryFile = defaultCurrentMemoryFile) {
  try {
    return JSON.parse(await fs.readFile(currentMemoryFile, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

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

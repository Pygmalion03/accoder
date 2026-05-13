import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
export const projectRoot = path.resolve(currentDir, "..", "..");
const problemsPath = path.join(projectRoot, "data", "problems.json");

let cachedProblems;

export function loadProblems() {
  if (!cachedProblems) {
    cachedProblems = JSON.parse(fs.readFileSync(problemsPath, "utf8"));
  }

  return cachedProblems;
}

export function findProblem(slugOrId) {
  const key = String(slugOrId ?? "").trim();
  const problem = loadProblems().find(
    (item) => item.slug === key || item.frontendId === key || item.leetcode?.slug === key,
  );

  if (!problem) {
    throw new Error(`Unknown problem: ${key}`);
  }

  return problem;
}

export function resolveProjectPath(relativePath) {
  return path.resolve(projectRoot, relativePath);
}

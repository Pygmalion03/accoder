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

function normalizeDate(date) {
  const value = String(date || new Date().toISOString().slice(0, 10)).trim();
  return value.slice(0, 10);
}

function normalizeCount(count) {
  const value = Math.floor(Number(count || 3));
  if (!Number.isFinite(value)) {
    return 3;
  }
  return Math.max(1, Math.min(5, value));
}

function difficultyMixFor(items) {
  return items.reduce(
    (mix, item) => {
      if (item.difficulty === "easy") {
        mix.easy += 1;
      } else if (item.difficulty === "medium") {
        mix.medium += 1;
      } else if (item.difficulty === "hard") {
        mix.hard += 1;
      }
      return mix;
    },
    { easy: 0, medium: 0, hard: 0 },
  );
}

function normalizeEstimatedMinutes(value) {
  const minutes = Math.floor(Number(value || 25));
  if (!Number.isFinite(minutes)) {
    return 25;
  }
  return Math.max(10, Math.min(90, minutes));
}

function planItemFromCandidate(candidate, overrides = {}) {
  return {
    leetcodeSlug: candidate.leetcodeSlug,
    title: candidate.title,
    leetcodeUrl: candidate.leetcodeUrl,
    difficulty: candidate.difficulty,
    tags: Array.isArray(candidate.tags) ? candidate.tags : [],
    focus: String(overrides.focus || candidate.tags?.[0] || candidate.difficulty || "practice"),
    reason: String(overrides.reason || "Selected by deterministic fallback ranking."),
    estimatedMinutes: normalizeEstimatedMinutes(overrides.estimatedMinutes),
    actions: {
      ...emptyActions(),
      ...(overrides.actions || {}),
    },
  };
}

export function validateAiPlan(rawPlan, candidates = [], date = new Date().toISOString().slice(0, 10)) {
  if (!rawPlan || !Array.isArray(rawPlan.items)) {
    throw new Error("AI plan did not include items.");
  }

  const candidateBySlug = new Map(candidates.map((candidate) => [candidate.leetcodeSlug, candidate]));
  const seen = new Set();
  const items = [];

  for (const rawItem of rawPlan.items) {
    const slug = String(rawItem?.leetcodeSlug || "").trim();
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
    date: normalizeDate(date),
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
    date: normalizeDate(date),
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

async function saveDailyPlan(plan, planFile = defaultDailyPlanFile) {
  const store = await loadPlanStore(planFile);
  store.plans[plan.date] = plan;
  await savePlanStore(store, planFile);
  return plan;
}

export async function loadDailyPlan(date = new Date().toISOString().slice(0, 10), planFile = defaultDailyPlanFile) {
  const store = await loadPlanStore(planFile);
  return store.plans[normalizeDate(date)] || null;
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

function normalizeBaseUrl(baseUrl) {
  return String(baseUrl || "https://api.openai.com/v1").trim().replace(/\/+$/, "") || "https://api.openai.com/v1";
}

async function requestAiPlan({ settings = {}, fetch, candidates = [], count = 3, date }) {
  if (!settings.apiKey) {
    throw new Error("Planner API key is not configured.");
  }

  const fetchFn = fetch || globalThis.fetch;
  if (!fetchFn) {
    throw new Error("fetch is not available in this Node.js runtime.");
  }

  const response = await fetchFn(`${normalizeBaseUrl(settings.baseUrl)}/chat/completions`, {
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
            date: normalizeDate(date),
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

export async function updateDailyPlanItemAction({
  planFile = defaultDailyPlanFile,
  date = new Date().toISOString().slice(0, 10),
  slug,
  action,
} = {}) {
  const plan = await loadDailyPlan(date, planFile);
  if (!plan) {
    throw new Error(`No daily plan found for ${normalizeDate(date)}.`);
  }

  const item = plan.items.find((entry) => entry.leetcodeSlug === slug);
  if (!item) {
    throw new Error(`Daily plan item not found: ${slug}`);
  }

  if (action === "open") {
    item.actions.opened = true;
  } else if (action === "add_to_practice") {
    item.actions.addedToPractice = true;
  } else if (action === "skip") {
    item.actions.skipped = true;
  } else if (action === "mastered") {
    item.actions.mastered = true;
  } else if (action === "want_practice_again") {
    item.actions.wantPracticeAgain = true;
  } else {
    throw new Error(`Unsupported daily plan action: ${action}`);
  }

  return saveDailyPlan(plan, planFile);
}

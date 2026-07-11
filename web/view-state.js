export const APP_VIEWS = Object.freeze(["today", "practice", "library", "catalog", "settings"]);
export const UTILITY_TABS = Object.freeze(["test", "result", "assist"]);

export function normalizeView(value) {
  return APP_VIEWS.includes(value) ? value : "today";
}

export function normalizeUtilityTab(value) {
  return UTILITY_TABS.includes(value) ? value : "test";
}

export function canonicalProblemSlug(problem) {
  const slug = problem?.leetcode?.slug ?? problem?.slug ?? "";
  return typeof slug === "string" ? slug.replace(/^memory:/, "") : "";
}

export function localDateForTimestamp(value) {
  if (value === null || value === undefined || (typeof value === "string" && value.trim() === "")) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function dailyPlanProgress(plan, problems = []) {
  const items = Array.isArray(plan?.items) ? plan.items : [];
  const acceptedSlugs = new Set(
    (Array.isArray(problems) ? problems : [])
      .filter((problem) => localDateForTimestamp(problem?.progress?.lastAcceptedAt) === plan?.date)
      .map(canonicalProblemSlug)
      .filter(Boolean),
  );
  const completed = items.filter((item) => acceptedSlugs.has(item?.leetcodeSlug)).length;
  const total = items.length;
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100);

  return { completed, total, percent };
}

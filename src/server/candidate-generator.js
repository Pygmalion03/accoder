const maxSourceRank = Number.MAX_SAFE_INTEGER;
const millisecondsPerDay = 24 * 60 * 60 * 1000;
const defaultSettings = {
  difficultyPressure: "standard",
  cooldownDays: 3,
  targetTags: [],
};
const difficultyWeights = {
  conservative: {
    easy: 14,
    medium: 8,
    hard: -8,
  },
  intensive: {
    hard: 14,
    medium: 10,
    easy: 4,
  },
  standard: {
    medium: 12,
    easy: 8,
    hard: 6,
  },
};
function normalizeText(value) {
  return String(value ?? "").trim();
}

function normalizeDifficulty(difficulty) {
  return normalizeText(difficulty).toLowerCase();
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
    const key = normalized.toLowerCase();
    if (!normalized || seen.has(key)) {
      continue;
    }

    seen.add(key);
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
  if (sourceRank === null || sourceRank === undefined || String(sourceRank).trim() === "") {
    return maxSourceRank;
  }

  const rank = Math.floor(Number(sourceRank));
  if (!Number.isFinite(rank) || rank < 0) {
    return maxSourceRank;
  }

  return rank;
}

function normalizeAcceptedCount(acceptedCount) {
  const count = Math.floor(Number(acceptedCount ?? 0));
  if (!Number.isFinite(count) || count < 0) {
    return 0;
  }

  return count;
}

function normalizeCooldownDays(cooldownDays) {
  if (cooldownDays === null || cooldownDays === undefined || String(cooldownDays).trim() === "") {
    return defaultSettings.cooldownDays;
  }

  const days = Math.floor(Number(cooldownDays));
  if (!Number.isFinite(days) || days < 0) {
    return defaultSettings.cooldownDays;
  }

  return days;
}

function normalizeDifficultyPressure(difficultyPressure) {
  const pressure = normalizeText(difficultyPressure).toLowerCase();
  return Object.hasOwn(difficultyWeights, pressure) ? pressure : defaultSettings.difficultyPressure;
}

function normalizeTargetTags(targetTags = []) {
  if (!Array.isArray(targetTags)) {
    return new Set();
  }

  return new Set(
    targetTags
      .filter((tag) => typeof tag === "string")
      .map((tag) => tag.trim().toLowerCase())
      .filter(Boolean),
  );
}

function normalizeLimit(limit) {
  const normalized = Math.floor(Number(limit));
  if (!Number.isFinite(normalized)) {
    return 30;
  }

  return Math.max(0, normalized);
}

function normalizeCatalogEntry(entry) {
  const leetcodeSlug = normalizeText(entry?.leetcodeSlug);
  const leetcodeUrl = normalizeText(entry?.leetcodeUrl);

  if (!leetcodeSlug || !leetcodeUrl) {
    return null;
  }

  return {
    leetcodeSlug,
    slug: leetcodeSlug,
    title: normalizeText(entry?.title),
    leetcodeUrl,
    url: leetcodeUrl,
    difficulty: normalizeDifficulty(entry?.difficulty),
    tags: normalizeTags(entry?.tags),
    frequencyScore: normalizeFrequencyScore(entry?.frequencyScore),
    sourceRank: normalizeSourceRank(entry?.sourceRank),
  };
}

function parseTime(value) {
  const text = normalizeText(value);
  if (!text) {
    return null;
  }

  const time = Date.parse(text);
  return Number.isFinite(time) ? time : null;
}

function scoreCandidate(candidate, item, settings, todayTime) {
  const reasons = [];
  let score = 0;

  if (candidate.frequencyScore > 0) {
    score += candidate.frequencyScore * 100;
    reasons.push("high frequency");
  }

  const tagMatches = new Set(
    candidate.tags.map((tag) => tag.toLowerCase()).filter((tag) => settings.targetTags.has(tag)),
  ).size;
  if (tagMatches > 0) {
    score += tagMatches * 16;
    reasons.push("matches target tags");
  }

  score += difficultyWeights[settings.difficultyPressure][candidate.difficulty] ?? 0;

  const acceptedCount = normalizeAcceptedCount(item?.acceptedCount);
  if (acceptedCount === 0) {
    score += 12;
    reasons.push("not accepted yet");
  } else {
    score -= acceptedCount * 8;
  }

  if (item?.wantPracticeAgain === true) {
    score += 18;
    reasons.push("marked for revisit");
  }

  if (normalizeText(item?.skippedAt)) {
    score -= 10;
    reasons.push("previously skipped");
  }

  const lastPracticedTime = parseTime(item?.lastPracticedAt);
  if (lastPracticedTime !== null && todayTime !== null) {
    const daysSincePractice = (todayTime - lastPracticedTime) / millisecondsPerDay;
    if (daysSincePractice < settings.cooldownDays) {
      score -= 40;
      reasons.push("recently practiced");
    } else {
      score += 12;
      reasons.push("ready for revisit");
    }
  }

  return {
    ...candidate,
    score,
    reasons,
  };
}

function candidateSort(a, b) {
  return b.score - a.score || a.sourceRank - b.sourceRank || a.leetcodeSlug.localeCompare(b.leetcodeSlug);
}

export function generateCandidates({
  catalogEntries = [],
  practiceProfile = {},
  today = new Date().toISOString(),
  limit = 30,
} = {}) {
  const settings = {
    difficultyPressure: normalizeDifficultyPressure(practiceProfile?.settings?.difficultyPressure),
    cooldownDays: normalizeCooldownDays(practiceProfile?.settings?.cooldownDays),
    targetTags: normalizeTargetTags(practiceProfile?.settings?.targetTags),
  };
  const profileItems =
    practiceProfile?.items && typeof practiceProfile.items === "object" ? practiceProfile.items : {};
  const todayTime = parseTime(today);
  const normalizedLimit = normalizeLimit(limit);

  return (Array.isArray(catalogEntries) ? catalogEntries : [])
    .map((entry) => normalizeCatalogEntry(entry))
    .filter(Boolean)
    .flatMap((candidate) => {
      const item = profileItems[candidate.leetcodeSlug] || {};
      if (normalizeText(item?.masteredAt) && item?.wantPracticeAgain !== true) {
        return [];
      }

      return [scoreCandidate(candidate, item, settings, todayTime)];
    })
    .sort(candidateSort)
    .slice(0, normalizedLimit);
}

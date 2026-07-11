import { hydrateIcons } from "./icons.js";
import { normalizeUtilityTab, normalizeView } from "./view-state.js";

const state = {
  problems: [],
  selected: null,
  lastMemoryCapturedAt: "",
  selectionMode: false,
  selectedProblemIds: new Set(),
  environment: null,
  runnerUserConfigured: false,
  dailyPlan: null,
  catalog: [],
  activeView: "today",
  activeUtilityTab: "test",
  mobilePracticeTab: "code",
  problemInspectorOpen: false,
  mobileMoreOpen: false,
};

const CACHE_KEYS = {
  selected: "acmcoder.web.selected",
  language: "acmcoder.web.language",
  runner: "acmcoder.web.runner",
};

const GENERIC_TEMPLATES = {
  python: `import sys


def main():
    data = sys.stdin.read()
    # TODO: parse stdin and print the answer


if __name__ == "__main__":
    main()
`,
  java: `import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        // TODO: read input and print the answer
    }
}
`,
  cpp: `#include <bits/stdc++.h>
using namespace std;

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    // TODO: parse stdin and print the answer
    string line;
    getline(cin, line);
    return 0;
}
`,
};

const elements = {
  appViews: [...document.querySelectorAll("[data-view]")],
  viewTargets: [...document.querySelectorAll("[data-view-target]")],
  utilityTabs: [...document.querySelectorAll("[data-utility-tab]")],
  utilityPanels: [...document.querySelectorAll("[data-utility-panel]")],
  mobilePracticeTabs: [...document.querySelectorAll("[data-mobile-practice-tab]")],
  mobilePracticePanels: [...document.querySelectorAll("[data-mobile-practice-panel]")],
  mobileMoreToggle: document.querySelector("#mobile-more-toggle"),
  mobileMoreMenu: document.querySelector("#mobile-more-menu"),
  globalSearch: document.querySelector("#global-search"),
  currentDate: document.querySelector("#current-date"),
  libraryCount: document.querySelector("#library-count"),
  navRunnerHealth: document.querySelector("#nav-runner-health"),
  search: document.querySelector("#search"),
  list: document.querySelector("#problem-list"),
  selectProblems: document.querySelector("#select-problems"),
  deleteProblems: document.querySelector("#delete-problems"),
  exportProblems: document.querySelector("#export-problems"),
  importProblems: document.querySelector("#import-problems"),
  importFile: document.querySelector("#import-file"),
  title: document.querySelector("#problem-title"),
  eyebrow: document.querySelector("#eyebrow"),
  link: document.querySelector("#leetcode-link"),
  description: document.querySelector("#problem-description"),
  language: document.querySelector("#language"),
  runner: document.querySelector("#runner"),
  runnerHealth: document.querySelector("#runner-health"),
  loadTemplate: document.querySelector("#load-template"),
  run: document.querySelector("#run"),
  codeEditor: document.querySelector("#code-editor"),
  lineNumbers: document.querySelector("#line-numbers"),
  code: document.querySelector("#code"),
  highlight: document.querySelector("#code-highlight code"),
  stdin: document.querySelector("#stdin"),
  expected: document.querySelector("#expected"),
  sampleIo: document.querySelector("#sample-io"),
  clearExpected: document.querySelector("#clear-expected"),
  status: document.querySelector("#status"),
  message: document.querySelector("#message"),
  stdout: document.querySelector("#stdout"),
  stderr: document.querySelector("#stderr"),
  assistKey: document.querySelector("#assist-key"),
  assistBaseUrl: document.querySelector("#assist-base-url"),
  assistModel: document.querySelector("#assist-model"),
  saveAssistSettings: document.querySelector("#save-assist-settings"),
  assistQuestion: document.querySelector("#assist-question"),
  askAssist: document.querySelector("#ask-assist"),
  assistAnswer: document.querySelector("#assist-answer"),
  dailyCount: document.querySelector("#daily-count"),
  dailyDifficulty: document.querySelector("#daily-difficulty"),
  dailyTags: document.querySelector("#daily-tags"),
  generateDaily: document.querySelector("#generate-daily"),
  importCatalog: document.querySelector("#import-catalog"),
  catalogFile: document.querySelector("#catalog-file"),
  dailyStatus: document.querySelector("#daily-status"),
  dailyList: document.querySelector("#daily-list"),
  catalogImport: document.querySelector("#catalog-import"),
  catalogStatus: document.querySelector("#catalog-status"),
  catalogList: document.querySelector("#catalog-list"),
  settingsImportProblems: document.querySelector("#settings-import-problems"),
  settingsExportProblems: document.querySelector("#settings-export-problems"),
  dailyPlanSource: document.querySelector("#daily-plan-source"),
  dailyProgressCount: document.querySelector("#daily-progress-count"),
  dailyProgressBar: document.querySelector("#daily-progress-bar"),
  dailySession: document.querySelector("#daily-session"),
  problemInspector: document.querySelector("#problem-inspector"),
  toggleProblemInspector: document.querySelector("#toggle-problem-inspector"),
};

const keywords = {
  python: [
    "and",
    "as",
    "assert",
    "break",
    "class",
    "continue",
    "def",
    "elif",
    "else",
    "except",
    "False",
    "finally",
    "for",
    "from",
    "if",
    "import",
    "in",
    "is",
    "lambda",
    "None",
    "not",
    "or",
    "pass",
    "raise",
    "return",
    "True",
    "try",
    "while",
    "with",
  ],
  java: [
    "boolean",
    "break",
    "case",
    "catch",
    "class",
    "continue",
    "else",
    "false",
    "final",
    "for",
    "if",
    "import",
    "int",
    "long",
    "new",
    "private",
    "public",
    "return",
    "static",
    "String",
    "true",
    "void",
    "while",
  ],
  cpp: [
    "auto",
    "bool",
    "break",
    "case",
    "class",
    "const",
    "continue",
    "else",
    "false",
    "for",
    "if",
    "include",
    "int",
    "long",
    "namespace",
    "return",
    "string",
    "true",
    "using",
    "vector",
    "void",
    "while",
  ],
};

const types = new Set([
  "ArrayDeque",
  "BufferedReader",
  "Deque",
  "HashMap",
  "InputStreamReader",
  "Map",
  "Scanner",
  "System",
  "bits",
  "std",
  "sys",
]);

const BRACKET_PAIRS = {
  "(": ")",
  "[": "]",
  "{": "}",
};

const CLOSING_BRACKETS = Object.fromEntries(Object.entries(BRACKET_PAIRS).map(([open, close]) => [close, open]));

async function getJson(url, options) {
  const response = await fetch(url, options);
  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.error || `Request failed: ${response.status}`);
  }
  return body;
}

function currentToolchainStatus() {
  return state.environment?.local?.[elements.language.value] || null;
}

function currentRunnerRecommendation() {
  return state.environment?.recommendedRunnerByLanguage?.[elements.language.value] || "";
}

function isDockerAppDeployment() {
  return state.environment?.deployment?.mode === "docker-app";
}

function runnerLabel(runner) {
  if (runner === "docker") {
    return "Docker runner";
  }
  return state.environment?.deployment?.localRunnerLabel || "本机环境";
}

function setRunnerHealth(message, kind = "") {
  elements.runnerHealth.textContent = message;
  elements.runnerHealth.className = `runner-health ${kind}`.trim();
  elements.navRunnerHealth.textContent = message;
  elements.navRunnerHealth.className = `nav-health ${kind}`.trim();
}

function updateRunnerModeOptions() {
  const localOption = elements.runner.querySelector('option[value="local"]');
  const dockerOption = elements.runner.querySelector('option[value="docker"]');
  const dockerApp = isDockerAppDeployment();

  if (localOption) {
    localOption.textContent = runnerLabel("local");
  }
  if (dockerOption) {
    dockerOption.textContent = "Docker runner";
    dockerOption.disabled = dockerApp;
  }
  if (dockerApp && elements.runner.value === "docker") {
    elements.runner.value = "local";
  }
}

function renderRunnerHealth() {
  if (!state.environment) {
    setRunnerHealth("尚未检测运行环境。");
    return;
  }

  const local = currentToolchainStatus();
  const docker = state.environment.docker;
  const runner = elements.runner.value;
  const recommendation = currentRunnerRecommendation();
  const suffix = recommendation && recommendation !== runner ? ` 推荐：${runnerLabel(recommendation)}。` : "";

  if (isDockerAppDeployment()) {
    const message = local?.ready
      ? `当前运行在 Docker app 容器中，${local.label} 已由内置环境提供；请使用“内置环境”运行代码。`
      : `当前运行在 Docker app 容器中，但内置环境缺少 ${local?.label || "当前语言"}。`;
    setRunnerHealth(message, local?.ready ? "ok" : "warn");
    return;
  }

  if (runner === "docker") {
    setRunnerHealth(docker.ready ? `Docker 可用。${docker.message}` : `Docker 不可用：${docker.message}`, docker.ready ? "ok" : "warn");
    return;
  }

  if (local?.ready) {
    setRunnerHealth(`${local.label} 本地环境可用。${suffix}`, "ok");
    return;
  }

  const missingCommands = local?.missingCommands?.join(", ") || "对应工具链";
  const dockerHint = docker?.ready ? "可以切换 Docker。" : "Docker 当前也不可用。";
  setRunnerHealth(`Local 缺少 ${missingCommands}；${dockerHint}${suffix}`, "warn");
}

function applyRecommendedRunnerIfNeeded() {
  if (state.runnerUserConfigured) {
    return;
  }

  const recommendedRunner = currentRunnerRecommendation();
  if (recommendedRunner && recommendedRunner !== elements.runner.value) {
    elements.runner.value = recommendedRunner;
  }
}

async function loadDoctor(options = {}) {
  try {
    state.environment = await getJson("/api/doctor");
    updateRunnerModeOptions();
    if (options.applyDefault) {
      applyRecommendedRunnerIfNeeded();
    }
    renderRunnerHealth();
  } catch (error) {
    setRunnerHealth(`环境检测失败：${error.message}`, "warn");
  }
}

function setAssistAnswer(message, kind = "") {
  elements.assistAnswer.textContent = message;
  elements.assistAnswer.className = `assist-answer ${kind}`.trim();
}

async function loadAssistSettings() {
  const body = await getJson("/api/assist/settings");
  elements.assistBaseUrl.value = body.settings?.baseUrl || "";
  elements.assistModel.value = body.settings?.model || "";
  elements.assistKey.placeholder = body.settings?.configured
    ? "已保存；留空则保留当前 Key"
    : "只保存在本机 data/memory/settings.json";
}

async function saveAssistSettings() {
  const payload = {
    baseUrl: elements.assistBaseUrl.value,
    model: elements.assistModel.value,
  };
  const apiKey = elements.assistKey.value.trim();
  if (apiKey) {
    payload.apiKey = apiKey;
  }

  const body = await getJson("/api/assist/settings", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  elements.assistKey.value = "";
  elements.assistKey.placeholder = body.settings?.configured ? "已保存；留空则保留当前 Key" : "只保存在本机 data/memory/settings.json";
  setAssistAnswer("模型设置已保存。", "ok");
}

async function askAssist() {
  elements.askAssist.disabled = true;
  setAssistAnswer("正在请求模型...");

  try {
    const body = await getJson("/api/assist", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        problemTitle: state.selected?.title,
        problemDescription: state.selected?.description,
        language: elements.language.value,
        code: elements.code.value,
        stdin: elements.stdin.value,
        expected: elements.expected.value,
        status: elements.status.textContent,
        stdout: elements.stdout.textContent,
        stderr: elements.stderr.textContent,
        question: elements.assistQuestion.value,
      }),
    });
    setAssistAnswer(body.message || "模型没有返回建议。", "ok");
  } catch (error) {
    setAssistAnswer(error.message, "error");
  } finally {
    elements.askAssist.disabled = false;
  }
}

function problemCacheKey(problem = state.selected) {
  return problem ? `acmcoder.web.problem.${problem.slug}.${elements.language.value}` : "";
}

function saveWorkspaceCache() {
  if (!state.selected) return;

  localStorage.setItem(CACHE_KEYS.selected, state.selected.slug);
  localStorage.setItem(CACHE_KEYS.language, elements.language.value);
  localStorage.setItem(
    problemCacheKey(),
    JSON.stringify({
      code: elements.code.value,
      stdin: elements.stdin.value,
      expected: elements.expected.value,
    }),
  );
}

function restoreWorkspaceCache() {
  if (!state.selected) return false;

  const raw = localStorage.getItem(problemCacheKey());
  if (!raw) return false;

  try {
    const cached = JSON.parse(raw);
    if (typeof cached.code === "string") elements.code.value = cached.code;
    if (typeof cached.stdin === "string") elements.stdin.value = cached.stdin;
    if (typeof cached.expected === "string") elements.expected.value = cached.expected;
    syncHighlight();
    return true;
  } catch {
    return false;
  }
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function classifyToken(token, language) {
  if (/^(\/\/|\/\*|#)/.test(token)) return "tok-comment";
  if (/^["']/.test(token)) return "tok-string";
  if (/^\d/.test(token)) return "tok-number";
  if (types.has(token)) return "tok-type";
  if (keywords[language]?.includes(token)) return "tok-keyword";
  return "";
}

function wrapHighlightedSegment(text, className, startIndex, bracketMatch) {
  if (!text) {
    return "";
  }

  let result = "";
  let cursor = 0;
  for (let index = 0; index < text.length; index += 1) {
    if (!bracketMatch.has(startIndex + index)) {
      continue;
    }

    if (index > cursor) {
      const chunk = escapeHtml(text.slice(cursor, index));
      result += className ? `<span class="${className}">${chunk}</span>` : chunk;
    }

    const classes = [className, "bracket-match"].filter(Boolean).join(" ");
    result += `<span class="${classes}">${escapeHtml(text[index])}</span>`;
    cursor = index + 1;
  }

  if (cursor < text.length) {
    const chunk = escapeHtml(text.slice(cursor));
    result += className ? `<span class="${className}">${chunk}</span>` : chunk;
  }

  return result;
}

function highlightCode(code, language, bracketMatch = new Set()) {
  const wordPattern = keywords[language]?.join("|") || "";
  const common = wordPattern ? `${wordPattern}|${[...types].join("|")}` : [...types].join("|");
  const expression =
    language === "python"
      ? new RegExp(`#.*|"""[\\s\\S]*?"""|'''[\\s\\S]*?'''|"(?:\\\\.|[^"\\\\])*"|'(?:\\\\.|[^'\\\\])*'|\\b(?:${common})\\b|\\b\\d+(?:\\.\\d+)?\\b`, "g")
      : new RegExp(`//.*|/\\*[\\s\\S]*?\\*/|"(?:\\\\.|[^"\\\\])*"|'(?:\\\\.|[^'\\\\])*'|\\b(?:${common})\\b|\\b\\d+(?:\\.\\d+)?\\b`, "g");

  let result = "";
  let cursor = 0;
  for (const match of code.matchAll(expression)) {
    const token = match[0];
    const index = match.index;
    const className = classifyToken(token, language);
    result += wrapHighlightedSegment(code.slice(cursor, index), "", cursor, bracketMatch);
    result += wrapHighlightedSegment(token, className, index, bracketMatch);
    cursor = index + token.length;
  }
  result += wrapHighlightedSegment(code.slice(cursor), "", cursor, bracketMatch);
  return result || "\n";
}

function findSelectedBracketIndex(value, selectionStart, selectionEnd) {
  if (selectionEnd - selectionStart === 1 && (BRACKET_PAIRS[value[selectionStart]] || CLOSING_BRACKETS[value[selectionStart]])) {
    return selectionStart;
  }

  if (selectionStart !== selectionEnd) {
    return -1;
  }

  if (BRACKET_PAIRS[value[selectionStart]] || CLOSING_BRACKETS[value[selectionStart]]) {
    return selectionStart;
  }

  const previous = selectionStart - 1;
  if (previous >= 0 && (BRACKET_PAIRS[value[previous]] || CLOSING_BRACKETS[value[previous]])) {
    return previous;
  }

  return -1;
}

function findMatchingBracket(value, bracketIndex) {
  const bracket = value[bracketIndex];
  const closing = BRACKET_PAIRS[bracket];
  const opening = CLOSING_BRACKETS[bracket];

  if (closing) {
    let depth = 0;
    for (let index = bracketIndex; index < value.length; index += 1) {
      if (value[index] === bracket) depth += 1;
      if (value[index] === closing) depth -= 1;
      if (depth === 0) return index;
    }
  }

  if (opening) {
    let depth = 0;
    for (let index = bracketIndex; index >= 0; index -= 1) {
      if (value[index] === bracket) depth += 1;
      if (value[index] === opening) depth -= 1;
      if (depth === 0) return index;
    }
  }

  return -1;
}

function getBracketMatch(value, selectionStart, selectionEnd) {
  const bracketIndex = findSelectedBracketIndex(value, selectionStart, selectionEnd);
  if (bracketIndex < 0) {
    return new Set();
  }

  const matchingIndex = findMatchingBracket(value, bracketIndex);
  return new Set(matchingIndex >= 0 ? [bracketIndex, matchingIndex] : [bracketIndex]);
}

function syncHighlight() {
  const bracketMatch = getBracketMatch(elements.code.value, elements.code.selectionStart, elements.code.selectionEnd);
  elements.highlight.innerHTML = highlightCode(elements.code.value, elements.language.value, bracketMatch);
  elements.highlight.parentElement.scrollTop = elements.code.scrollTop;
  elements.highlight.parentElement.scrollLeft = elements.code.scrollLeft;
  syncLineNumbers();
  autoSizeCodeEditor();
}

function syncLineNumbers() {
  const lineCount = Math.max(1, elements.code.value.split("\n").length);
  const nextValue = Array.from({ length: lineCount }, (_, index) => String(index + 1)).join("\n");
  if (elements.lineNumbers.textContent !== nextValue) {
    elements.lineNumbers.textContent = nextValue;
  }
  elements.lineNumbers.scrollTop = elements.code.scrollTop;
}

function autoSizeCodeEditor() {
  const minHeight = Number.parseFloat(getComputedStyle(elements.codeEditor).minHeight) || 260;
  elements.code.style.height = "auto";
  const nextHeight = Math.max(minHeight, elements.code.scrollHeight);
  elements.codeEditor.style.height = `${nextHeight}px`;
  elements.code.style.height = "100%";
}

function replaceSelection(nextText, selectionOffset = nextText.length) {
  const start = elements.code.selectionStart;
  const end = elements.code.selectionEnd;
  const value = elements.code.value;
  elements.code.value = value.slice(0, start) + nextText + value.slice(end);
  const cursor = start + selectionOffset;
  elements.code.setSelectionRange(cursor, cursor);
  syncHighlight();
}

function indentSelection(outdent = false) {
  const value = elements.code.value;
  const start = elements.code.selectionStart;
  const end = elements.code.selectionEnd;
  const lineStart = value.lastIndexOf("\n", start - 1) + 1;
  const selected = value.slice(lineStart, end);
  const lines = selected.split("\n");
  const changed = lines
    .map((line) => {
      if (!outdent) return `    ${line}`;
      if (line.startsWith("    ")) return line.slice(4);
      if (line.startsWith("\t")) return line.slice(1);
      return line;
    })
    .join("\n");
  elements.code.value = value.slice(0, lineStart) + changed + value.slice(end);
  const delta = changed.length - selected.length;
  elements.code.setSelectionRange(Math.max(lineStart, start + (outdent ? Math.min(0, delta) : 4)), end + delta);
  syncHighlight();
}

function handleEditorKeydown(event) {
  const pairs = {
    "(": ")",
    "[": "]",
    "{": "}",
    '"': '"',
    "'": "'",
  };
  const closingPairs = {
    ")": "(",
    "]": "[",
    "}": "{",
    '"': '"',
    "'": "'",
  };
  const isPlainKey = !event.ctrlKey && !event.metaKey && !event.altKey;

  if (event.key === "Tab") {
    event.preventDefault();
    indentSelection(event.shiftKey);
    return;
  }

  if (event.key === "Enter") {
    event.preventDefault();
    const value = elements.code.value;
    const start = elements.code.selectionStart;
    const lineStart = value.lastIndexOf("\n", start - 1) + 1;
    const line = value.slice(lineStart, start);
    const baseIndent = line.match(/^\s*/)[0];
    const extraIndent = /[{(:]\s*$/.test(line) ? "    " : "";
    const nextChar = value[start];

    if (nextChar === "}" && extraIndent) {
      replaceSelection(`\n${baseIndent}${extraIndent}\n${baseIndent}`, 1 + baseIndent.length + extraIndent.length);
    } else {
      replaceSelection(`\n${baseIndent}${extraIndent}`);
    }
    return;
  }

  if (
    closingPairs[event.key] &&
    isPlainKey &&
    elements.code.selectionStart === elements.code.selectionEnd &&
    elements.code.value[elements.code.selectionStart] === event.key
  ) {
    event.preventDefault();
    elements.code.setSelectionRange(elements.code.selectionStart + 1, elements.code.selectionStart + 1);
    syncHighlight();
    return;
  }

  if (pairs[event.key] && isPlainKey) {
    event.preventDefault();
    const start = elements.code.selectionStart;
    const end = elements.code.selectionEnd;
    const selected = elements.code.value.slice(start, end);
    replaceSelection(`${event.key}${selected}${pairs[event.key]}`, selected ? selected.length + 2 : 1);
  }
}

function handleEditorBeforeInput(event) {
  const closingPairs = {
    ")": "(",
    "]": "[",
    "}": "{",
    '"': '"',
    "'": "'",
  };

  if (
    event.inputType === "insertText" &&
    closingPairs[event.data] &&
    elements.code.selectionStart === elements.code.selectionEnd &&
    elements.code.value[elements.code.selectionStart] === event.data
  ) {
    event.preventDefault();
    elements.code.setSelectionRange(elements.code.selectionStart + 1, elements.code.selectionStart + 1);
    syncHighlight();
  }
}

function problemIdForProblem(problem) {
  return problem?.slug || "";
}

function progressKeyForSlug(slug) {
  return String(slug || "").replace(/^memory:/, "");
}

function getAcCount(problem) {
  const count = Number(problem.progress?.acCount || 0);
  return Number.isFinite(count) && count > 0 ? count : 0;
}

function applyProgress(slug, progress) {
  if (!progress) {
    return;
  }

  const targetKey = progressKeyForSlug(slug || progress.slug);
  for (const problem of state.problems) {
    if (progressKeyForSlug(problem.slug) === targetKey) {
      problem.progress = progress;
    }
  }

  if (state.selected && progressKeyForSlug(state.selected.slug) === targetKey) {
    state.selected.progress = progress;
  }
}

function selectedProblemIdsOrAll() {
  if (state.selectedProblemIds.size > 0) {
    return [...state.selectedProblemIds];
  }
  return state.problems.map(problemIdForProblem);
}

function updateProblemActions() {
  const selectedCount = state.selectedProblemIds.size;
  elements.selectProblems.textContent = state.selectionMode ? "完成选择" : "选择题目";
  elements.exportProblems.disabled = state.problems.length === 0;
  elements.deleteProblems.hidden = !state.selectionMode;
  elements.deleteProblems.disabled = selectedCount === 0;
  elements.exportProblems.textContent = selectedCount > 0 ? `导出选中 (${selectedCount})` : "导出全部";
  elements.deleteProblems.textContent = selectedCount > 0 ? `删除选中 (${selectedCount})` : "删除选中";
}

function renderProblemList() {
  const query = elements.search.value.trim().toLowerCase();
  elements.list.innerHTML = "";

  const problems = state.problems.filter((problem) => {
    const haystack = [problem.slug, problem.frontendId, problem.title, problem.difficulty, ...problem.tags]
      .join(" ")
      .toLowerCase();
    return haystack.includes(query);
  });

  for (const problem of problems) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `problem-item${state.selected?.slug === problem.slug ? " active" : ""}`;
    button.innerHTML = `<strong>${formatProblemListTitle(problem)}</strong><span class="problem-meta">${problem.slug} · ${problem.difficulty}</span><span class="ac-count">AC ${getAcCount(problem)}</span>`;
    button.addEventListener("click", () => selectProblem(problem.slug));
    if (!state.selectionMode) {
      elements.list.appendChild(button);
      continue;
    }

    const problemId = problemIdForProblem(problem);
    const row = document.createElement("div");
    row.className = "problem-row";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "memory-select";
    checkbox.checked = state.selectedProblemIds.has(problemId);
    checkbox.setAttribute("aria-label", `选择 ${problem.title}`);
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) {
        state.selectedProblemIds.add(problemId);
      } else {
        state.selectedProblemIds.delete(problemId);
      }
      updateProblemActions();
    });

    row.appendChild(checkbox);
    row.appendChild(button);
    elements.list.appendChild(row);
  }

  updateProblemActions();
}

async function loadTemplate(options = {}) {
  if (!state.selected) return;
  const persist = options.persist !== false;

  if (state.selected.memorySource) {
    elements.code.value = GENERIC_TEMPLATES[elements.language.value] || "";
    syncHighlight();
    if (persist) saveWorkspaceCache();
    return;
  }

  const language = elements.language.value;
  const body = await getJson(`/api/templates/${state.selected.slug}/${language}`);
  elements.code.value = body.code;
  syncHighlight();
  if (persist) saveWorkspaceCache();
}

function restoreSampleIo() {
  const sample = state.selected?.sample;
  if (sample && (typeof sample.inputText === "string" || typeof sample.outputText === "string")) {
    elements.stdin.value = sample.inputText || "";
    elements.expected.value = sample.outputText || "";
    return;
  }

  const firstCase = state.selected?.cases?.[0];
  elements.stdin.value = firstCase?.inputText || "";
  elements.expected.value = firstCase?.outputText || "";
}

function normalizeDifficulty(value) {
  const difficulty = String(value || "").toLowerCase();
  const difficultyMap = {
    "简单": "easy",
    "中等": "medium",
    "困难": "hard",
  };
  return difficultyMap[value] || difficulty;
}

function buildMemoryProblem(page) {
  const tags = Array.from(new Set((Array.isArray(page.tags) ? page.tags : []).filter(Boolean)));

  return {
    slug: `memory:${page.slug}`,
    memorySource: true,
    frontendId: page.frontendId || page.questionFrontendId || "",
    title: page.title || page.slug,
    difficulty: normalizeDifficulty(page.difficulty || ""),
    tags,
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
    description: page.content,
    progress: page.progress || { acCount: 0 },
    cases: [],
  };
}

function upsertMemoryProblem(page) {
  const problem = buildMemoryProblem(page);
  const existingIndex = state.problems.findIndex((item) => item.slug === problem.slug);
  if (existingIndex >= 0) {
    state.problems.splice(existingIndex, 1);
  }
  state.problems.unshift(problem);
  state.lastMemoryCapturedAt = page.capturedAt || "";
  return problem;
}

function latestMemoryPages(pages = []) {
  const latestBySlug = new Map();

  for (const page of pages) {
    if (!page?.slug) {
      continue;
    }

    const existing = latestBySlug.get(page.slug);
    const existingTime = Date.parse(existing?.capturedAt || 0);
    const nextTime = Date.parse(page.capturedAt || 0);
    if (!existing || nextTime >= existingTime) {
      latestBySlug.set(page.slug, page);
    }
  }

  return [...latestBySlug.values()].sort((a, b) => Date.parse(a.capturedAt || 0) - Date.parse(b.capturedAt || 0));
}

function shouldSelectNewMemory(problem, autoSelect) {
  if (!autoSelect) {
    return false;
  }
  if (!state.selected) {
    return true;
  }
  return state.selected.slug === problem.slug;
}

async function loadMemoryHistory() {
  const body = await getJson("/api/memory/pages");
  const pages = latestMemoryPages(body.pages || []);

  for (const page of pages) {
    upsertMemoryProblem(page);
  }

  renderProblemList();
  return pages.length > 0;
}

function formatEyebrow(problem) {
  const parts = [
    problem.frontendId ? `#${problem.frontendId}` : "",
    problem.difficulty,
    ...(Array.isArray(problem.tags) ? problem.tags : []),
    `AC ${getAcCount(problem)}`,
  ].filter(Boolean);

  return parts.join(" · ");
}

function formatProblemListTitle(problem) {
  return problem.frontendId ? `#${problem.frontendId} ${problem.title}` : problem.title;
}

async function selectProblem(slug, options = {}) {
  const existing = state.problems.find((item) => item.slug === slug);
  const problem = existing?.memorySource ? existing : (await getJson(`/api/problems/${slug}`)).problem;
  state.selected = problem;
  applyProgress(problem.slug, problem.progress);

  elements.eyebrow.textContent = formatEyebrow(problem);
  elements.title.textContent = problem.title;
  elements.link.href = problem.leetcode.url;
  elements.description.textContent = problem.description;

  restoreSampleIo();
  if (options.loadTemplate !== false) {
    await loadTemplate({ persist: false });
  }
  restoreWorkspaceCache();
  saveWorkspaceCache();
  renderProblemList();
  if (options.openView !== false) {
    setActiveView("practice");
  }
}

function setResult(result) {
  elements.status.className = `status ${result.status}`;
  elements.status.textContent = result.status;
  elements.message.textContent = result.message || "";
  elements.stdout.textContent = result.stdout || "";
  elements.stderr.textContent = result.stderr || "";
}

async function runCode() {
  elements.status.className = "status";
  elements.status.textContent = "RUNNING";
  elements.message.textContent = `Running ${elements.runner.value} runner...`;
  elements.stdout.textContent = "";
  elements.stderr.textContent = "";

  try {
    const body = await getJson("/api/run", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        slug: state.selected.slug,
        language: elements.language.value,
        runner: elements.runner.value,
        code: elements.code.value,
        stdin: elements.stdin.value,
        expected: elements.expected.value,
      }),
    });
    setResult(body.result);
    if (body.result.status === "AC" && body.progress) {
      applyProgress(state.selected.slug, body.progress);
      renderProblemList();
      elements.eyebrow.textContent = formatEyebrow(state.selected);
    }
    saveWorkspaceCache();
  } catch (error) {
    setResult({
      status: "ERROR",
      message: error.message,
      stdout: "",
      stderr: "",
    });
  }
}

function cleanupProblemWorkspaceCache(slug) {
  for (const language of ["python", "java", "cpp"]) {
    localStorage.removeItem(`acmcoder.web.problem.${slug}.${language}`);
  }
}

function downloadJson(filename, body) {
  const blob = new Blob([JSON.stringify(body, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function readJsonFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      try {
        resolve(JSON.parse(String(reader.result || "")));
      } catch (error) {
        reject(error);
      }
    });
    reader.addEventListener("error", () => reject(reader.error || new Error("Failed to read file.")));
    reader.readAsText(file, "utf-8");
  });
}

function setMobileMoreOpen(open) {
  state.mobileMoreOpen = Boolean(open);
  elements.mobileMoreMenu.hidden = !state.mobileMoreOpen;
  elements.mobileMoreToggle.setAttribute("aria-expanded", String(state.mobileMoreOpen));
}

function setActiveView(value, { focus = false } = {}) {
  const view = normalizeView(value);
  state.activeView = view;
  document.body.dataset.activeView = view;

  for (const panel of elements.appViews) {
    const active = panel.dataset.view === view;
    panel.hidden = !active;
    panel.classList.toggle("is-active", active);
    if (active && focus) panel.focus({ preventScroll: true });
  }

  for (const target of elements.viewTargets) {
    const active = target.dataset.viewTarget === view;
    target.classList.toggle("is-active", active);
    if (target.closest("#app-navigation, #mobile-navigation")) {
      if (active) target.setAttribute("aria-current", "page");
      else target.removeAttribute("aria-current");
    }
  }

  setMobileMoreOpen(false);
}

function setUtilityTab(value) {
  const tab = normalizeUtilityTab(value);
  state.activeUtilityTab = tab;
  for (const button of elements.utilityTabs) {
    const active = button.dataset.utilityTab === tab;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-selected", String(active));
  }
  for (const panel of elements.utilityPanels) {
    panel.hidden = panel.dataset.utilityPanel !== tab;
  }
}

function updateLibraryCount() {
  elements.libraryCount.textContent = String(state.problems.length);
}

function setDailyStatus(message, kind = "") {
  elements.dailyStatus.textContent = message;
  elements.dailyStatus.className = `daily-status ${kind}`.trim();
}

function dailyTagsFromInput() {
  return elements.dailyTags.value
    .split(/[,，]/)
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function formatDailyMeta(item) {
  return [
    item.difficulty,
    ...(Array.isArray(item.tags) ? item.tags : []),
    item.estimatedMinutes ? `${item.estimatedMinutes} min` : "",
  ]
    .filter(Boolean)
    .join(" · ");
}

function renderDailyPlan(plan) {
  state.dailyPlan = plan;
  elements.dailyList.innerHTML = "";

  if (!plan?.items?.length) {
    setDailyStatus("还没有今日计划。导入推荐题库后点击生成。");
    return;
  }

  setDailyStatus(`${plan.theme} · ${plan.source === "ai" ? "AI 推荐" : "本地规则"}`);

  for (const item of plan.items) {
    const addedToPractice = Boolean(item.actions?.addedToPractice);
    const mastered = Boolean(item.actions?.mastered);
    const row = document.createElement("article");
    row.className = "daily-item";
    row.innerHTML = `
      <div class="daily-item-head">
        <div>
          <h4>${escapeHtml(item.title || item.leetcodeSlug)}</h4>
          <p class="daily-item-meta">${escapeHtml(formatDailyMeta(item))}</p>
        </div>
        <div class="daily-item-actions">
          <a class="link-button" href="${escapeHtml(item.leetcodeUrl)}" target="_blank" rel="noreferrer" data-daily-action="open" data-slug="${escapeHtml(item.leetcodeSlug)}">LeetCode</a>
          <button type="button" data-daily-action="add_to_practice" data-slug="${escapeHtml(item.leetcodeSlug)}" ${addedToPractice ? "disabled" : ""}>${addedToPractice ? "已加入" : "加入练习"}</button>
          <button type="button" class="secondary" data-daily-action="skip" data-slug="${escapeHtml(item.leetcodeSlug)}">跳过</button>
          <button type="button" class="secondary" data-daily-action="mastered" data-slug="${escapeHtml(item.leetcodeSlug)}" ${mastered ? "disabled" : ""}>${mastered ? "已掌握" : "标记掌握"}</button>
        </div>
      </div>
      <p class="daily-item-reason">${escapeHtml(item.reason || item.focus || "")}</p>
    `;
    elements.dailyList.appendChild(row);
  }
}

async function importRecommendationCatalog(file) {
  if (!file) {
    return;
  }

  const payload = await readJsonFile(file);
  const body = await getJson("/api/recommendation/import", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  setDailyStatus(`已导入 ${body.importedCount || 0} 道推荐题。`, "ok");
  await loadRecommendationCatalog();
}

function renderRecommendationCatalog() {
  elements.catalogList.innerHTML = "";
  if (state.catalog.length === 0) {
    elements.catalogStatus.textContent = "推荐题库为空，请先导入题库文件。";
    return;
  }

  elements.catalogStatus.textContent = `共 ${state.catalog.length} 道高频题，仅作为每日推荐来源。`;
  for (const item of state.catalog) {
    const row = document.createElement("article");
    row.className = "catalog-item";
    row.innerHTML = `<strong>${escapeHtml(item.title || item.leetcodeSlug || item.slug)}</strong>`;
    elements.catalogList.appendChild(row);
  }
}

async function loadRecommendationCatalog() {
  const body = await getJson("/api/recommendation/catalog");
  state.catalog = Array.isArray(body.catalog?.entries) ? body.catalog.entries : [];
  renderRecommendationCatalog();
}

async function loadTodayPlan() {
  const body = await getJson("/api/daily-plan/today");
  renderDailyPlan(body.plan);
}

async function generateDailyPlan() {
  elements.generateDaily.disabled = true;
  setDailyStatus("正在生成今日计划...");

  try {
    const body = await getJson("/api/daily-plan/generate", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        count: Number(elements.dailyCount.value),
        difficultyPressure: elements.dailyDifficulty.value,
        targetTags: dailyTagsFromInput(),
      }),
    });
    renderDailyPlan(body.plan);
  } catch (error) {
    setDailyStatus(error.message, "error");
  } finally {
    elements.generateDaily.disabled = false;
  }
}

async function recordDailyAction(slug, action) {
  if (!slug || !action) {
    return;
  }

  const body = await getJson(`/api/daily-plan/items/${encodeURIComponent(slug)}/action`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ action }),
  });
  renderDailyPlan(body.plan);
  if (action === "add_to_practice") {
    await reloadProblems();
  }
}

async function reloadProblems({ preserveView = false } = {}) {
  const body = await getJson("/api/problems");
  state.problems = body.problems;
  await loadMemoryHistory().catch(() => false);
  renderProblemList();
  updateLibraryCount();

  if (!state.selected || !state.problems.some((problem) => problem.slug === state.selected.slug)) {
    const fallback = state.problems[0];
    if (fallback) {
      await selectProblem(fallback.slug, { openView: !preserveView });
    }
  }
}

async function importProblems(file) {
  if (!file) {
    return;
  }

  const payload = await readJsonFile(file);
  const body = await getJson("/api/problems/import", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  state.selectedProblemIds.clear();
  state.selectionMode = false;
  await reloadProblems();
  setResult({
    status: "IDLE",
    message: `已导入 ${body.importedCount || 0} 道题目。`,
    stdout: "",
    stderr: "",
  });
}

async function deleteSelectedProblems() {
  const slugs = [...state.selectedProblemIds];
  if (slugs.length === 0) {
    return;
  }

  if (!window.confirm(`删除选中的 ${slugs.length} 道记忆题目？`)) {
    return;
  }

  const body = await getJson("/api/problems", {
    method: "DELETE",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ slugs }),
  });
  const deletedSlugs = new Set(body.deletedSlugs || []);
  const selectedWasDeleted = state.selected && deletedSlugs.has(problemIdForProblem(state.selected));

  for (const slug of deletedSlugs) {
    state.selectedProblemIds.delete(slug);
    cleanupProblemWorkspaceCache(slug);
  }

  state.problems = state.problems.filter((problem) => !deletedSlugs.has(problemIdForProblem(problem)));
  renderProblemList();
  setResult({
    status: "IDLE",
    message: `已删除 ${deletedSlugs.size} 道记忆题目。`,
    stdout: "",
    stderr: "",
  });

  elements.message.textContent = `已删除 ${deletedSlugs.size} 道题目。`;

  if (selectedWasDeleted) {
    const fallback = state.problems[0];
    if (fallback) {
      await selectProblem(fallback.slug);
    }
  }
}

async function exportProblems() {
  const slugs = selectedProblemIdsOrAll();
  if (slugs.length === 0) {
    return;
  }

  const query = slugs.length > 0 ? `?slugs=${encodeURIComponent(slugs.join(","))}` : "";
  const body = await getJson(`/api/problems/export${query}`);
  downloadJson(`acmcoder-problems-${new Date().toISOString().slice(0, 10)}.json`, body);
}

async function loadCurrentMemory({ autoSelect = false } = {}) {
  const body = await getJson("/api/memory/current");
  if (!body.page?.slug || body.page.capturedAt === state.lastMemoryCapturedAt) {
    return false;
  }

  const problem = upsertMemoryProblem(body.page);
  renderProblemList();

  if (shouldSelectNewMemory(problem, autoSelect)) {
    await selectProblem(problem.slug);
  }

  return true;
}

async function init() {
  hydrateIcons();
  elements.currentDate.textContent = new Intl.DateTimeFormat("zh-CN", {
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(new Date());
  setActiveView("today");
  setUtilityTab("test");

  const body = await getJson("/api/problems");
  state.problems = body.problems;
  updateLibraryCount();
  elements.language.value = localStorage.getItem(CACHE_KEYS.language) || elements.language.value;
  const savedRunner = localStorage.getItem(CACHE_KEYS.runner);
  state.runnerUserConfigured = Boolean(savedRunner);
  elements.runner.value = savedRunner || elements.runner.value;
  await loadDoctor({ applyDefault: true });
  await loadAssistSettings().catch((error) => {
    setAssistAnswer(`模型设置读取失败：${error.message}`, "error");
  });
  for (const target of elements.viewTargets) {
    target.addEventListener("click", () => setActiveView(target.dataset.viewTarget, { focus: true }));
  }
  for (const tab of elements.utilityTabs) {
    tab.addEventListener("click", () => setUtilityTab(tab.dataset.utilityTab));
  }
  elements.mobileMoreToggle.addEventListener("click", () => setMobileMoreOpen(!state.mobileMoreOpen));
  elements.globalSearch.addEventListener("click", () => {
    setActiveView("library");
    elements.search.focus();
  });
  elements.search.addEventListener("input", renderProblemList);
  elements.selectProblems.addEventListener("click", () => {
    state.selectionMode = !state.selectionMode;
    if (!state.selectionMode) {
      state.selectedProblemIds.clear();
    }
    renderProblemList();
  });
  elements.deleteProblems.addEventListener("click", () => {
    deleteSelectedProblems().catch((error) => {
      setResult({ status: "ERROR", message: error.message, stdout: "", stderr: "" });
    });
  });
  elements.exportProblems.addEventListener("click", () => {
    exportProblems().catch((error) => {
      setResult({ status: "ERROR", message: error.message, stdout: "", stderr: "" });
    });
  });
  elements.importProblems.addEventListener("click", () => {
    elements.importFile.click();
  });
  elements.settingsImportProblems.addEventListener("click", () => elements.importFile.click());
  elements.settingsExportProblems.addEventListener("click", () => {
    exportProblems().catch((error) => {
      setResult({ status: "ERROR", message: error.message, stdout: "", stderr: "" });
    });
  });
  elements.importFile.addEventListener("change", () => {
    importProblems(elements.importFile.files?.[0])
      .catch((error) => {
        setResult({ status: "ERROR", message: error.message, stdout: "", stderr: "" });
      })
      .finally(() => {
        elements.importFile.value = "";
      });
  });
  elements.importCatalog.addEventListener("click", () => {
    elements.catalogFile.click();
  });
  elements.catalogImport.addEventListener("click", () => elements.catalogFile.click());
  elements.catalogFile.addEventListener("change", () => {
    importRecommendationCatalog(elements.catalogFile.files?.[0])
      .catch((error) => {
        setDailyStatus(error.message, "error");
      })
      .finally(() => {
        elements.catalogFile.value = "";
      });
  });
  elements.generateDaily.addEventListener("click", () => {
    generateDailyPlan();
  });
  elements.dailyList.addEventListener("click", (event) => {
    const target = event.target.closest("[data-daily-action]");
    if (!target) {
      return;
    }
    const slug = target.getAttribute("data-slug");
    const action = target.getAttribute("data-daily-action");
    recordDailyAction(slug, action).catch((error) => setDailyStatus(error.message, "error"));
  });
  elements.language.addEventListener("change", async () => {
    localStorage.setItem(CACHE_KEYS.language, elements.language.value);
    applyRecommendedRunnerIfNeeded();
    renderRunnerHealth();
    if (!restoreWorkspaceCache()) {
      await loadTemplate();
    }
  });
  elements.runner.addEventListener("change", () => {
    state.runnerUserConfigured = true;
    localStorage.setItem(CACHE_KEYS.runner, elements.runner.value);
    renderRunnerHealth();
  });
  elements.saveAssistSettings.addEventListener("click", () => {
    saveAssistSettings().catch((error) => setAssistAnswer(error.message, "error"));
  });
  elements.askAssist.addEventListener("click", askAssist);
  elements.loadTemplate.addEventListener("click", loadTemplate);
  elements.sampleIo.addEventListener("click", () => {
    restoreSampleIo();
    saveWorkspaceCache();
  });
  elements.clearExpected.addEventListener("click", () => {
    elements.expected.value = "";
    saveWorkspaceCache();
  });
  elements.run.addEventListener("click", runCode);
  elements.code.addEventListener("input", () => {
    syncHighlight();
    saveWorkspaceCache();
  });
  elements.code.addEventListener("scroll", syncHighlight);
  elements.code.addEventListener("select", syncHighlight);
  elements.code.addEventListener("click", syncHighlight);
  elements.code.addEventListener("keyup", syncHighlight);
  elements.code.addEventListener("beforeinput", handleEditorBeforeInput);
  elements.code.addEventListener("keydown", handleEditorKeydown);
  elements.stdin.addEventListener("input", saveWorkspaceCache);
  elements.expected.addEventListener("input", saveWorkspaceCache);
  await loadMemoryHistory().catch(() => false);
  await loadTodayPlan().catch(() => {
    renderDailyPlan(null);
  });
  await loadRecommendationCatalog().catch((error) => {
    elements.catalogStatus.textContent = `推荐题库读取失败：${error.message}`;
  });
  renderProblemList();
  updateLibraryCount();
  const cachedSelected = localStorage.getItem(CACHE_KEYS.selected);
  const fallback = state.problems.find((problem) => problem.slug === cachedSelected) || state.problems[0];
  if (fallback) {
    await selectProblem(fallback.slug, { openView: false });
  }
  await loadCurrentMemory({ autoSelect: true }).catch(() => false);
  setInterval(() => {
    loadCurrentMemory({ autoSelect: true }).catch(() => {});
  }, 2000);
  setActiveView("today");
}

init().catch((error) => {
  elements.title.textContent = "启动失败";
  elements.message.textContent = error.message;
});

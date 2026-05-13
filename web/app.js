const state = {
  problems: [],
  selected: null,
  lastMemoryCapturedAt: "",
};

const CACHE_KEYS = {
  selected: "acmcoder.web.selected",
  language: "acmcoder.web.language",
};

const GENERIC_TEMPLATES = {
  python: `import sys


def main():
    data = sys.stdin.read()
    # TODO: parse stdin and print the answer
    print(data.strip())


if __name__ == "__main__":
    main()
`,
  java: `import java.io.BufferedReader;
import java.io.InputStreamReader;

public class Main {
    public static void main(String[] args) throws Exception {
        BufferedReader reader = new BufferedReader(new InputStreamReader(System.in));
        // TODO: parse stdin and print the answer
        String line = reader.readLine();
        if (line != null) {
            System.out.println(line);
        }
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
    if (getline(cin, line)) {
        cout << line << '\\n';
    }
    return 0;
}
`,
};

const elements = {
  search: document.querySelector("#search"),
  list: document.querySelector("#problem-list"),
  title: document.querySelector("#problem-title"),
  eyebrow: document.querySelector("#eyebrow"),
  link: document.querySelector("#leetcode-link"),
  description: document.querySelector("#problem-description"),
  language: document.querySelector("#language"),
  loadTemplate: document.querySelector("#load-template"),
  run: document.querySelector("#run"),
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

async function getJson(url, options) {
  const response = await fetch(url, options);
  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.error || `Request failed: ${response.status}`);
  }
  return body;
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

function highlightCode(code, language) {
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
    result += escapeHtml(code.slice(cursor, index));
    result += className ? `<span class="${className}">${escapeHtml(token)}</span>` : escapeHtml(token);
    cursor = index + token.length;
  }
  result += escapeHtml(code.slice(cursor));
  return result || "\n";
}

function syncHighlight() {
  elements.highlight.innerHTML = highlightCode(elements.code.value, elements.language.value);
  elements.highlight.parentElement.scrollTop = elements.code.scrollTop;
  elements.highlight.parentElement.scrollLeft = elements.code.scrollLeft;
  syncLineNumbers();
}

function syncLineNumbers() {
  const lineCount = Math.max(1, elements.code.value.split("\n").length);
  const nextValue = Array.from({ length: lineCount }, (_, index) => String(index + 1)).join("\n");
  if (elements.lineNumbers.textContent !== nextValue) {
    elements.lineNumbers.textContent = nextValue;
  }
  elements.lineNumbers.scrollTop = elements.code.scrollTop;
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

  if (pairs[event.key] && !event.ctrlKey && !event.metaKey && !event.altKey) {
    event.preventDefault();
    const start = elements.code.selectionStart;
    const end = elements.code.selectionEnd;
    const selected = elements.code.value.slice(start, end);
    replaceSelection(`${event.key}${selected}${pairs[event.key]}`, selected ? selected.length + 2 : 1);
  }
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
    button.innerHTML = `<strong>${formatProblemListTitle(problem)}</strong><span>${problem.slug} · ${problem.difficulty} · ${problem.rank.frequency}</span>`;
    button.addEventListener("click", () => selectProblem(problem.slug));
    elements.list.appendChild(button);
  }
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
  ].filter(Boolean);

  if (!problem.memorySource && problem.rank?.frequency) {
    parts.push(`frequency ${problem.rank.frequency}`);
  }

  return parts.join(" · ");
}

function formatProblemListTitle(problem) {
  return problem.frontendId ? `#${problem.frontendId} ${problem.title}` : problem.title;
}

async function selectProblem(slug, options = {}) {
  const existing = state.problems.find((item) => item.slug === slug);
  const problem = existing?.memorySource ? existing : (await getJson(`/api/problems/${slug}`)).problem;
  state.selected = problem;

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
  elements.message.textContent = "Running local toolchain...";
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
        code: elements.code.value,
        stdin: elements.stdin.value,
        expected: elements.expected.value,
      }),
    });
    setResult(body.result);
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
  const body = await getJson("/api/problems");
  state.problems = body.problems;
  elements.language.value = localStorage.getItem(CACHE_KEYS.language) || elements.language.value;
  elements.search.addEventListener("input", renderProblemList);
  elements.language.addEventListener("change", async () => {
    localStorage.setItem(CACHE_KEYS.language, elements.language.value);
    if (!restoreWorkspaceCache()) {
      await loadTemplate();
    }
  });
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
  elements.code.addEventListener("keydown", handleEditorKeydown);
  elements.stdin.addEventListener("input", saveWorkspaceCache);
  elements.expected.addEventListener("input", saveWorkspaceCache);
  await loadMemoryHistory().catch(() => false);
  renderProblemList();
  const cachedSelected = localStorage.getItem(CACHE_KEYS.selected);
  const fallback = state.problems.find((problem) => problem.slug === cachedSelected) || state.problems[0];
  if (fallback) {
    await selectProblem(fallback.slug);
  }
  await loadCurrentMemory({ autoSelect: true }).catch(() => false);
  setInterval(() => {
    loadCurrentMemory({ autoSelect: true }).catch(() => {});
  }, 2000);
}

init().catch((error) => {
  elements.title.textContent = "启动失败";
  elements.message.textContent = error.message;
});

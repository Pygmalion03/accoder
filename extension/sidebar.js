const LOCAL_BASE = "http://127.0.0.1:43117";
const STORAGE_KEYS = {
  memoryMode: "acmcoder.memoryMode",
  lastPage: "acmcoder.lastPage",
  language: "acmcoder.sidebar.language",
  runner: "acmcoder.sidebar.runner",
};

const GENERIC_TEMPLATES = {
  python: `import sys


def main():
    data = sys.stdin.read()
    # TODO: parse stdin and print the answer


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

let capturedPage = null;
let environment = null;
let runnerUserConfigured = false;

const elements = {
  memoryMode: document.querySelector("#memory-mode"),
  capture: document.querySelector("#capture"),
  save: document.querySelector("#save"),
  status: document.querySelector("#status"),
  title: document.querySelector("#title"),
  slug: document.querySelector("#slug"),
  tags: document.querySelector("#tags"),
  acCount: document.querySelector("#ac-count"),
  runnerHealth: document.querySelector("#runner-health"),
  assistKey: document.querySelector("#assist-key"),
  assistBaseUrl: document.querySelector("#assist-base-url"),
  assistModel: document.querySelector("#assist-model"),
  saveAssistSettings: document.querySelector("#save-assist-settings"),
  assistQuestion: document.querySelector("#assist-question"),
  askAssist: document.querySelector("#ask-assist"),
  assistAnswer: document.querySelector("#assist-answer"),
  memoryFile: document.querySelector("#memory-file"),
  openLocal: document.querySelector("#open-local"),
  language: document.querySelector("#language"),
  runner: document.querySelector("#runner"),
  resetCode: document.querySelector("#reset-code"),
  sampleIo: document.querySelector("#sample-io"),
  runCode: document.querySelector("#run-code"),
  codeEditor: document.querySelector("#code-editor"),
  lineNumbers: document.querySelector("#line-numbers"),
  code: document.querySelector("#code"),
  highlight: document.querySelector("#code-highlight code"),
  stdin: document.querySelector("#stdin"),
  expected: document.querySelector("#expected"),
  runStatus: document.querySelector("#run-status"),
  message: document.querySelector("#message"),
  stdout: document.querySelector("#stdout"),
  stderr: document.querySelector("#stderr"),
};

function setStatus(message, kind = "") {
  elements.status.textContent = message;
  elements.status.className = `status ${kind}`.trim();
}

function setRunResult(result) {
  elements.runStatus.textContent = result.status || "IDLE";
  elements.runStatus.className = `run-status ${result.status || ""}`.trim();
  elements.message.textContent = result.message || "";
  elements.stdout.textContent = result.stdout || "";
  elements.stderr.textContent = result.stderr || "";
}

function setRunnerHealth(message, kind = "") {
  elements.runnerHealth.textContent = message;
  elements.runnerHealth.className = `runner-health ${kind}`.trim();
}

function currentToolchainStatus() {
  return environment?.local?.[elements.language.value] || null;
}

function currentRunnerRecommendation() {
  return environment?.recommendedRunnerByLanguage?.[elements.language.value] || "";
}

function isDockerAppDeployment() {
  return environment?.deployment?.mode === "docker-app";
}

function runnerLabel(runner) {
  if (runner === "docker") {
    return "Docker runner";
  }
  return environment?.deployment?.localRunnerLabel || "本机环境";
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
  if (!environment) {
    setRunnerHealth("尚未检测运行环境。");
    return;
  }

  const local = currentToolchainStatus();
  const docker = environment.docker;
  const runner = elements.runner.value;
  const recommendation = currentRunnerRecommendation();
  const suffix = recommendation && recommendation !== runner ? ` 推荐：${runnerLabel(recommendation)}。` : "";

  if (isDockerAppDeployment()) {
    const message = local?.ready
      ? `当前本地服务运行在 Docker app 容器中，${local.label} 已由内置环境提供；请使用“内置环境”运行代码。`
      : `当前本地服务运行在 Docker app 容器中，但内置环境缺少 ${local?.label || "当前语言"}。`;
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
  if (runnerUserConfigured) {
    return;
  }

  const recommendedRunner = currentRunnerRecommendation();
  if (recommendedRunner && recommendedRunner !== elements.runner.value) {
    elements.runner.value = recommendedRunner;
  }
}

async function loadDoctor(options = {}) {
  try {
    environment = await getJson(`${LOCAL_BASE}/api/doctor`);
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

function storageGet(keys) {
  return new Promise((resolve) => chrome.storage.local.get(keys, resolve));
}

function storageSet(values) {
  return new Promise((resolve) => chrome.storage.local.set(values, resolve));
}

function sendRuntimeMessage(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(new Error(error.message));
        return;
      }
      resolve(response);
    });
  });
}

async function getJson(url, options) {
  const response = await fetch(url, options);
  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.error || `本地服务返回 ${response.status}`);
  }
  return body;
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function markPanelOpened() {
  const tab = await getActiveTab();
  if (!tab?.id) {
    return;
  }

  await sendRuntimeMessage({
    type: "ACMCODER_PANEL_OPENED",
    tabId: tab.id,
    url: tab.url || "",
  });
}

function sendTabMessage(tabId, message) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(new Error(error.message));
        return;
      }
      resolve(response);
    });
  });
}

function isMissingReceiverError(error) {
  return /Receiving end does not exist|Could not establish connection/i.test(error.message || "");
}

function ensureContentScript(tabId) {
  return new Promise((resolve, reject) => {
    chrome.scripting.executeScript(
      {
        target: { tabId },
        files: ["content-script.js"],
      },
      () => {
        const error = chrome.runtime.lastError;
        if (error) {
          reject(new Error(error.message));
          return;
        }
        resolve();
      },
    );
  });
}

async function captureFromTab(tabId) {
  try {
    return await sendTabMessage(tabId, { type: "ACMCODER_CAPTURE" });
  } catch (error) {
    if (!isMissingReceiverError(error)) {
      throw error;
    }

    setStatus("页面脚本未连接，正在自动注入后重试...", "");
    await ensureContentScript(tabId);
    return sendTabMessage(tabId, { type: "ACMCODER_CAPTURE" });
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
  const terms = [...(keywords[language] || []), ...types].map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const common = terms.join("|");
  const wordPart = common ? `|\\b(?:${common})\\b` : "";
  const expression =
    language === "python"
      ? new RegExp(`#.*|"""[\\s\\S]*?"""|'''[\\s\\S]*?'''|"(?:\\\\.|[^"\\\\])*"|'(?:\\\\.|[^'\\\\])*'${wordPart}|\\b\\d+(?:\\.\\d+)?\\b`, "g")
      : new RegExp(`//.*|/\\*[\\s\\S]*?\\*/|"(?:\\\\.|[^"\\\\])*"|'(?:\\\\.|[^'\\\\])*'${wordPart}|\\b\\d+(?:\\.\\d+)?\\b`, "g");

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
  const minHeight = Number.parseFloat(getComputedStyle(elements.codeEditor).minHeight) || 220;
  elements.code.style.height = "auto";
  const nextHeight = Math.max(minHeight, elements.code.scrollHeight);
  elements.codeEditor.style.height = `${nextHeight}px`;
  elements.code.style.height = "100%";
}

function sidebarWorkspaceKey(page = capturedPage) {
  const slug = page?.slug || "scratch";
  return `acmcoder.sidebar.workspace.${slug}.${elements.language.value}`;
}

async function saveWorkspaceCache() {
  await storageSet({
    [STORAGE_KEYS.language]: elements.language.value,
    [sidebarWorkspaceKey()]: {
      code: elements.code.value,
      stdin: elements.stdin.value,
      expected: elements.expected.value,
    },
  });
}

async function restoreWorkspaceCache() {
  const key = sidebarWorkspaceKey();
  const values = await storageGet([key]);
  const cached = values[key];
  if (!cached) {
    return false;
  }

  if (typeof cached.code === "string") elements.code.value = cached.code;
  if (typeof cached.stdin === "string") elements.stdin.value = cached.stdin;
  if (typeof cached.expected === "string") elements.expected.value = cached.expected;
  syncHighlight();
  return true;
}

function resetCode(options = {}) {
  elements.code.value = GENERIC_TEMPLATES[elements.language.value] || "";
  syncHighlight();
  if (options.persist !== false) {
    void saveWorkspaceCache();
  }
}

function restoreSampleIo(options = {}) {
  elements.stdin.value = capturedPage?.sample?.inputText || "";
  elements.expected.value = capturedPage?.sample?.outputText || "";
  if (options.persist !== false) {
    void saveWorkspaceCache();
  }
}

function renderTags(page) {
  const tags = [page.difficulty, ...(Array.isArray(page.tags) ? page.tags : [])].filter(Boolean);
  elements.tags.innerHTML = tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("");
}

function getAcCount(progress) {
  const count = Number(progress?.acCount || 0);
  return Number.isFinite(count) && count > 0 ? count : 0;
}

function renderProgress(progress = capturedPage?.progress) {
  elements.acCount.textContent = `AC ${getAcCount(progress)}`;
}

async function refreshCapturedProgress() {
  if (!capturedPage?.slug) {
    renderProgress();
    return;
  }

  const body = await getJson(`${LOCAL_BASE}/api/memory/pages?slug=${encodeURIComponent(capturedPage.slug)}`);
  const page = body.pages?.[0];
  if (page?.progress) {
    capturedPage = { ...capturedPage, progress: page.progress };
    renderProgress(page.progress);
    await cachePage(capturedPage);
  }
}

async function renderPage(page) {
  capturedPage = page;
  elements.title.textContent = page.title || page.slug || "-";
  elements.slug.textContent = page.slug || "未读取";
  renderTags(page);
  renderProgress(page.progress);

  const restored = await restoreWorkspaceCache();
  if (!restored) {
    resetCode({ persist: false });
    restoreSampleIo({ persist: false });
    await saveWorkspaceCache();
  }
}

async function cachePage(page) {
  await storageSet({ [STORAGE_KEYS.lastPage]: page });
}

async function loadCachedPage() {
  const values = await storageGet([STORAGE_KEYS.lastPage]);
  const page = values[STORAGE_KEYS.lastPage];
  if (page?.slug) {
    await renderPage(page);
    await refreshCapturedProgress().catch(() => {});
    setStatus(`已恢复最近读取：${page.slug}`, "ok");
    return true;
  }
  resetCode({ persist: false });
  return false;
}

async function captureCurrentProblem() {
  const tab = await getActiveTab();
  if (!tab?.id || !/^https:\/\/leetcode\.(cn|com)\/problems\//.test(tab.url || "")) {
    throw new Error("当前标签页不是 LeetCode 题目页。");
  }

  const response = await captureFromTab(tab.id);
  if (!response?.ok || !response.page?.content) {
    throw new Error(response?.error || "没有读取到题目内容。");
  }

  await renderPage(response.page);
  await cachePage(response.page);
  setStatus("已读取当前题目，侧栏样例已同步。", "ok");

  if (elements.memoryMode.checked) {
    await saveCapturedPage();
  }
}

async function saveCapturedPage() {
  if (!capturedPage) {
    throw new Error("请先读取当前题目。");
  }

  const body = await getJson(`${LOCAL_BASE}/api/memory/pages`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(capturedPage),
  });

  capturedPage = { ...capturedPage, progress: body.page.progress };
  renderProgress(body.page.progress);
  await cachePage(capturedPage);
  setStatus(`已记忆到本地：${body.page.slug}。ACMCoder 页面会自动加载。`, "ok");
}

async function runCode() {
  elements.runCode.disabled = true;
  setRunResult({
    status: "RUNNING",
    message: `Running ${elements.runner.value} runner...`,
    stdout: "",
    stderr: "",
  });

  try {
    await saveWorkspaceCache();
    const body = await getJson(`${LOCAL_BASE}/api/run`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        slug: capturedPage?.slug || "scratch",
        language: elements.language.value,
        runner: elements.runner.value,
        code: elements.code.value,
        stdin: elements.stdin.value,
        expected: elements.expected.value,
      }),
    });
    setRunResult(body.result);
    if (body.progress) {
      capturedPage = capturedPage ? { ...capturedPage, progress: body.progress } : capturedPage;
      renderProgress(body.progress);
      if (capturedPage) {
        await cachePage(capturedPage);
      }
    }
  } catch (error) {
    setRunResult({
      status: "ERROR",
      message: error.message || "运行失败，请确认本地 ACMCoder 服务已启动。",
      stdout: "",
      stderr: "",
    });
  } finally {
    elements.runCode.disabled = false;
  }
}

async function loadMemoryLocation() {
  try {
    const body = await getJson(`${LOCAL_BASE}/api/memory/location`);
    elements.memoryFile.textContent = body.file || "未获取到路径";
  } catch {
    elements.memoryFile.textContent = "本地服务未启动";
  }
}

async function loadSettings() {
  const values = await storageGet([STORAGE_KEYS.memoryMode, STORAGE_KEYS.language, STORAGE_KEYS.runner]);
  elements.memoryMode.checked = Boolean(values[STORAGE_KEYS.memoryMode]);
  elements.language.value = values[STORAGE_KEYS.language] || elements.language.value;
  runnerUserConfigured = Boolean(values[STORAGE_KEYS.runner]);
  elements.runner.value = values[STORAGE_KEYS.runner] || elements.runner.value;
}

async function saveSettings(options = {}) {
  const values = {
    [STORAGE_KEYS.memoryMode]: elements.memoryMode.checked,
    [STORAGE_KEYS.language]: elements.language.value,
  };

  if (options.includeRunner !== false) {
    values[STORAGE_KEYS.runner] = elements.runner.value;
  }

  await storageSet(values);
}

async function loadAssistSettings() {
  const body = await getJson(`${LOCAL_BASE}/api/assist/settings`);
  elements.assistBaseUrl.value = body.settings?.baseUrl || "";
  elements.assistModel.value = body.settings?.model || "";
  elements.assistKey.placeholder = body.settings?.configured ? "已保存；留空则保留当前 Key" : "只保存到本机服务";
}

async function saveApiKey() {
  const payload = {
    baseUrl: elements.assistBaseUrl.value,
    model: elements.assistModel.value,
  };
  const apiKey = elements.assistKey.value.trim();
  if (apiKey) {
    payload.apiKey = apiKey;
  }

  const body = await getJson(`${LOCAL_BASE}/api/assist/settings`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  elements.assistKey.value = "";
  elements.assistKey.placeholder = body.settings?.configured ? "已保存；留空则保留当前 Key" : "只保存到本机服务";
  setStatus("模型设置已保存到本机服务。", "ok");
}

async function askAssist() {
  elements.askAssist.disabled = true;
  setAssistAnswer("正在请求模型...");

  try {
    const body = await getJson(`${LOCAL_BASE}/api/assist`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        problemTitle: capturedPage?.title,
        problemDescription: capturedPage?.content,
        language: elements.language.value,
        code: elements.code.value,
        stdin: elements.stdin.value,
        expected: elements.expected.value,
        status: elements.runStatus.textContent,
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

function replaceSelection(nextText, selectionOffset = nextText.length) {
  const start = elements.code.selectionStart;
  const end = elements.code.selectionEnd;
  const value = elements.code.value;
  elements.code.value = value.slice(0, start) + nextText + value.slice(end);
  const cursor = start + selectionOffset;
  elements.code.setSelectionRange(cursor, cursor);
  syncHighlight();
  void saveWorkspaceCache();
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
  void saveWorkspaceCache();
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

async function handleLanguageChange() {
  const stdin = elements.stdin.value;
  const expected = elements.expected.value;
  applyRecommendedRunnerIfNeeded();
  renderRunnerHealth();
  await saveSettings({ includeRunner: runnerUserConfigured });
  const restored = await restoreWorkspaceCache();
  if (!restored) {
    resetCode({ persist: false });
    elements.stdin.value = stdin;
    elements.expected.value = expected;
    await saveWorkspaceCache();
  }
}

async function runAction(action) {
  try {
    await action();
  } catch (error) {
    setStatus(error.message, "error");
  }
}

elements.memoryMode.addEventListener("change", () => runAction(() => saveSettings({ includeRunner: runnerUserConfigured })));
elements.capture.addEventListener("click", () => runAction(captureCurrentProblem));
elements.save.addEventListener("click", () => runAction(saveCapturedPage));
elements.saveAssistSettings.addEventListener("click", () => runAction(saveApiKey));
elements.openLocal.addEventListener("click", () => {
  chrome.tabs.create({ url: LOCAL_BASE });
});
elements.language.addEventListener("change", () => runAction(handleLanguageChange));
elements.runner.addEventListener("change", () =>
  runAction(async () => {
    runnerUserConfigured = true;
    await saveSettings();
    renderRunnerHealth();
  }),
);
elements.resetCode.addEventListener("click", () => resetCode());
elements.sampleIo.addEventListener("click", restoreSampleIo);
elements.askAssist.addEventListener("click", askAssist);
elements.runCode.addEventListener("click", runCode);
elements.code.addEventListener("input", () => {
  syncHighlight();
  void saveWorkspaceCache();
});
elements.code.addEventListener("scroll", syncHighlight);
elements.code.addEventListener("select", syncHighlight);
elements.code.addEventListener("click", syncHighlight);
elements.code.addEventListener("keyup", syncHighlight);
elements.code.addEventListener("beforeinput", handleEditorBeforeInput);
elements.code.addEventListener("keydown", handleEditorKeydown);
elements.stdin.addEventListener("input", () => void saveWorkspaceCache());
elements.expected.addEventListener("input", () => void saveWorkspaceCache());

runAction(async () => {
  await markPanelOpened();
  await loadSettings();
  await loadDoctor({ applyDefault: true });
  await loadAssistSettings().catch((error) => setAssistAnswer(`模型设置读取失败：${error.message}`, "error"));
  await loadCachedPage();
  await loadMemoryLocation();
  syncHighlight();
});

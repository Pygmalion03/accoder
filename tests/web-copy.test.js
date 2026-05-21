import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

test("web UI exposes self-test output and reset wording", () => {
  const html = fs.readFileSync("web/index.html", "utf8");

  assert.match(html, /还原初始代码/);
  assert.match(html, /自测预期输出/);
  assert.match(html, /code-highlight/);
});

test("web UI uses a single problem description section", () => {
  const html = fs.readFileSync("web/index.html", "utf8");

  assert.match(html, /题目描述/);
  assert.doesNotMatch(html, /输入描述/);
  assert.doesNotMatch(html, /输出描述/);
  assert.doesNotMatch(html, /样例说明/);
});

test("web UI preserves LeetCode problem description line breaks", () => {
  const css = fs.readFileSync("web/styles.css", "utf8");

  assert.match(css, /#problem-description/);
  assert.match(css, /white-space:\s*pre-wrap/);
  assert.match(css, /overflow-wrap:\s*anywhere/);
});

test("web app polls current memory and persists workspace cache", () => {
  const script = fs.readFileSync("web/app.js", "utf8");

  assert.match(script, /api\/memory\/current/);
  assert.match(script, /localStorage/);
  assert.match(script, /restoreWorkspaceCache/);
});

test("web app loads memory history without replacing active selection", () => {
  const script = fs.readFileSync("web/app.js", "utf8");

  assert.match(script, /loadMemoryHistory/);
  assert.match(script, /api\/memory\/pages/);
  assert.match(script, /shouldSelectNewMemory/);
});

test("web app preserves captured metadata and sample IO for memory problems", () => {
  const script = fs.readFileSync("web/app.js", "utf8");

  assert.match(script, /frontendId:\s*page\.frontendId/);
  assert.match(script, /page\.difficulty/);
  assert.match(script, /Array\.isArray\(page\.tags\)/);
  assert.match(script, /sample:\s*page\.sample/);
  assert.match(script, /state\.selected\?\.sample/);
});

test("web app renders the title eyebrow from id difficulty and tags", () => {
  const script = fs.readFileSync("web/app.js", "utf8");

  assert.match(script, /formatEyebrow/);
  assert.match(script, /problem\.frontendId/);
  assert.match(script, /problem\.difficulty/);
  assert.match(script, /problem\.tags/);
  assert.doesNotMatch(script, /problem\.rank\.frequency/);
  assert.doesNotMatch(script, /frequency \$\{problem\.rank\.frequency\}/);
});

test("web editor renders line numbers next to code", () => {
  const html = fs.readFileSync("web/index.html", "utf8");
  const css = fs.readFileSync("web/styles.css", "utf8");
  const script = fs.readFileSync("web/app.js", "utf8");

  assert.match(html, /id="line-numbers"/);
  assert.match(css, /\.line-numbers/);
  assert.match(css, /grid-template-columns:\s*auto minmax\(0,\s*1fr\)/);
  assert.match(css, /\.code-scroll\s*\{[\s\S]*height:\s*100%/);
  assert.match(css, /#code,\s*#code-highlight,\s*\.line-numbers\s*\{[\s\S]*height:\s*100%/);
  assert.match(css, /#code\s*\{[\s\S]*resize:\s*none/);
  assert.match(css, /#code\s*\{[\s\S]*color:\s*#d8dee9/);
  assert.match(script, /lineNumbers:\s*document\.querySelector\("#line-numbers"\)/);
  assert.match(script, /syncLineNumbers/);
});

test("web UI exposes local and docker runner modes", () => {
  const html = fs.readFileSync("web/index.html", "utf8");
  const script = fs.readFileSync("web/app.js", "utf8");
  const css = fs.readFileSync("web/styles.css", "utf8");

  assert.match(html, /id="runner"/);
  assert.match(html, /value="local"/);
  assert.match(html, /value="docker"/);
  assert.match(script, /runner:\s*document\.querySelector\("#runner"\)/);
  assert.match(script, /runner:\s*elements\.runner\.value/);
  assert.match(script, /acmcoder\.web\.runner/);
  assert.match(css, /\.status\.NO_RUNNER/);
});

test("web UI shows environment doctor status for runner modes", () => {
  const html = fs.readFileSync("web/index.html", "utf8");
  const script = fs.readFileSync("web/app.js", "utf8");
  const css = fs.readFileSync("web/styles.css", "utf8");

  assert.match(html, /id="runner-health"/);
  assert.match(script, /api\/doctor/);
  assert.match(script, /recommendedRunnerByLanguage/);
  assert.match(script, /renderRunnerHealth/);
  assert.match(script, /missingCommands/);
  assert.match(css, /\.runner-health/);
  assert.match(css, /\.runner-health\.warn/);
});

test("web UI exposes lightweight optional model advice", () => {
  const html = fs.readFileSync("web/index.html", "utf8");
  const script = fs.readFileSync("web/app.js", "utf8");
  const css = fs.readFileSync("web/styles.css", "utf8");

  assert.match(html, /id="assist-key"/);
  assert.match(html, /id="assist-base-url"/);
  assert.match(html, /id="assist-model"/);
  assert.match(html, /id="save-assist-settings"/);
  assert.match(html, /id="assist-question"/);
  assert.match(html, /id="assist-question"[^>]*placeholder="请看一下我的代码，指出可能的问题和修改建议。"[^>]*><\/textarea>/);
  assert.doesNotMatch(html, /<textarea id="assist-question"[^>]*>请看一下我的代码/);
  assert.match(html, /id="ask-assist"/);
  assert.match(html, /id="assist-answer"/);
  assert.match(script, /api\/assist\/settings/);
  assert.match(script, /api\/assist/);
  assert.match(script, /askAssist/);
  assert.match(script, /saveAssistSettings/);
  assert.match(script, /problemTitle:\s*state\.selected\?\.title/);
  assert.match(css, /\.assist-panel/);
  assert.match(css, /\.assist-answer/);
});

test("web UI exposes problem selection, batch delete, and export controls", () => {
  const html = fs.readFileSync("web/index.html", "utf8");
  const script = fs.readFileSync("web/app.js", "utf8");
  const css = fs.readFileSync("web/styles.css", "utf8");

  assert.match(html, /id="select-problems"/);
  assert.match(html, /id="delete-problems"/);
  assert.match(html, /id="export-problems"/);
  assert.match(html, /id="import-problems"/);
  assert.match(html, /id="import-file"/);
  assert.match(script, /selectionMode:\s*false/);
  assert.match(script, /selectedProblemIds:\s*new Set\(\)/);
  assert.match(script, /api\/problems\/export/);
  assert.match(script, /api\/problems\/import/);
  assert.match(script, /api\/problems/);
  assert.match(script, /method:\s*"DELETE"/);
  assert.match(script, /method:\s*"POST"/);
  assert.match(script, /deleteSelectedProblems/);
  assert.match(script, /exportProblems/);
  assert.match(script, /importProblems/);
  assert.match(script, /FileReader/);
  assert.match(script, /problemIdForProblem/);
  assert.match(css, /\.memory-actions/);
  assert.match(css, /\.memory-select/);
  assert.match(css, /\.problem-item[\s\S]*color:\s*var\(--ink\)/);
});

test("web UI records accepted counts and highlights them", () => {
  const script = fs.readFileSync("web/app.js", "utf8");
  const css = fs.readFileSync("web/styles.css", "utf8");

  assert.doesNotMatch(script, /acmcoder\.web\.acCounts/);
  assert.doesNotMatch(script, /localStorage\.getItem\(CACHE_KEYS\.acCounts/);
  assert.match(script, /body\.result\.status === "AC"/);
  assert.match(script, /body\.progress/);
  assert.match(script, /problem\.progress/);
  assert.match(script, /getAcCount\(problem\)/);
  assert.match(script, /class="ac-count"/);
  assert.match(css, /\.ac-count/);
});

test("web editor skips over already inserted closing brackets", () => {
  const script = fs.readFileSync("web/app.js", "utf8");

  assert.match(script, /closingPairs/);
  assert.match(script, /handleEditorBeforeInput/);
  assert.match(script, /event\.inputType === "insertText"/);
  assert.match(script, /elements\.code\.value\[elements\.code\.selectionStart\] === event\.key/);
  assert.match(script, /elements\.code\.value\[elements\.code\.selectionStart\] === event\.data/);
  assert.match(script, /setSelectionRange\(elements\.code\.selectionStart \+ 1/);
  assert.match(script, /addEventListener\("beforeinput", handleEditorBeforeInput\)/);
});

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

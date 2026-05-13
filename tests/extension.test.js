import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

test("edge extension manifest exposes a side panel on leetcode pages", () => {
  const manifest = JSON.parse(fs.readFileSync("extension/manifest.json", "utf8"));

  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.side_panel.default_path, "sidebar.html");
  assert.ok(manifest.permissions.includes("sidePanel"));
  assert.ok(manifest.permissions.includes("scripting"));
  assert.ok(manifest.host_permissions.includes("https://leetcode.cn/*"));
  assert.ok(manifest.host_permissions.includes("https://leetcode.com/*"));
  assert.ok(manifest.host_permissions.includes("http://127.0.0.1:43117/*"));
});

test("background hides the panel on other tabs and restores tabs that opened it", () => {
  const script = fs.readFileSync("extension/background.js", "utf8");

  assert.match(script, /isLeetCodeProblemUrl/);
  assert.match(script, /const openedTabs = new Set\(\)/);
  assert.match(script, /OPENED_TABS_KEY/);
  assert.match(script, /chrome\.storage\.local\.get/);
  assert.match(script, /chrome\.storage\.local\.set/);
  assert.doesNotMatch(script, /chrome\.storage\.session/);
  assert.match(script, /rememberOpenedTab/);
  assert.match(script, /forgetOpenedTab/);
  assert.match(script, /openedTabs\.add\(tabId\)/);
  assert.match(script, /rememberOpenedTab\(tab\.id\)/);
  assert.match(script, /rememberOpenedTab\(message\.tabId\)/);
  assert.match(script, /openedTabs\.has\(tabId\)/);
  assert.match(script, /chrome\.tabs\.onRemoved\.addListener/);
  assert.match(script, /forgetOpenedTab\(tabId\)/);
  assert.match(script, /chrome\.action\.onClicked/);
  assert.match(script, /openAcmcoderForTab/);
  assert.match(script, /chrome\.sidePanel\.open\(\{\s*tabId/);
  assert.match(script, /const shouldOpen = isLeetCodeProblemUrl\(url\) && openedTabs\.has\(tabId\)/);
  assert.match(script, /enabled:\s*shouldOpen/);
  assert.match(script, /if \(shouldOpen && chrome\.sidePanel\?\.open\)/);
  assert.match(script, /chrome\.tabs\.create\(\{\s*url:\s*LOCAL_BASE/);
  assert.match(script, /setDefaultSidePanelClosed/);
  assert.match(script, /chrome\.runtime\.onInstalled\.addListener/);
  assert.doesNotMatch(script, /chrome\.runtime\.onStartup/);
  assert.doesNotMatch(script, /^configureSidePanelDefaults\(\);/m);
  assert.match(script, /chrome\.tabs\.onUpdated/);
  assert.match(script, /chrome\.tabs\.onActivated/);
  assert.match(script, /ACMCODER_PANEL_OPENED/);
  assert.doesNotMatch(script, /openPanelOnActionClick/);
  assert.doesNotMatch(script, /setPanelBehavior/);
});

test("edge sidebar keeps only compact capture status plus the practice panel", () => {
  const html = fs.readFileSync("extension/sidebar.html", "utf8");

  assert.match(html, /id="memory-mode"/);
  assert.match(html, /LLM API Key/);
  assert.match(html, /id="save"/);
  assert.match(html, /practice-panel/);
  assert.match(html, /id="run-code"/);
  assert.match(html, /id="code"/);
  assert.match(html, /id="stdin"/);
  assert.match(html, /id="stdout"/);
  assert.doesNotMatch(html, /<textarea id="content"/);
  assert.doesNotMatch(html, /id="summary"/);
});

test("content script reads question metadata from leetcode", () => {
  const script = fs.readFileSync("extension/content-script.js", "utf8");

  assert.match(script, /ACMCODER_CAPTURE/);
  assert.match(script, /captureLeetCodeProblem/);
  assert.match(script, /fetchQuestionData/);
  assert.match(script, /LEETCODE_CN_ORIGIN/);
  assert.match(script, /\/graphql\//);
  assert.match(script, /topicTags/);
  assert.match(script, /translatedName/);
  assert.match(script, /双指针/);
  assert.match(script, /字符串/);
  assert.match(script, /动态规划/);
  assert.match(script, /extractFirstExample/);
});

test("sidebar injects the content script when message receiver is missing", () => {
  const script = fs.readFileSync("extension/sidebar.js", "utf8");

  assert.match(script, /ensureContentScript/);
  assert.match(script, /chrome\.scripting\.executeScript/);
  assert.match(script, /Receiving end does not exist/);
});

test("sidebar caches the last captured problem", () => {
  const script = fs.readFileSync("extension/sidebar.js", "utf8");

  assert.match(script, /lastPage/);
  assert.match(script, /loadCachedPage/);
  assert.match(script, /ACMCODER_PANEL_OPENED/);
});

test("sidebar can run code through the local runner", () => {
  const script = fs.readFileSync("extension/sidebar.js", "utf8");

  assert.match(script, /runCode/);
  assert.match(script, /api\/run/);
  assert.match(script, /sidebarWorkspaceKey/);
});

test("sidebar editor renders line numbers next to code", () => {
  const html = fs.readFileSync("extension/sidebar.html", "utf8");
  const css = fs.readFileSync("extension/sidebar.css", "utf8");
  const script = fs.readFileSync("extension/sidebar.js", "utf8");

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

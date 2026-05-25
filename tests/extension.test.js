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
  assert.match(script, /openAccoderForTab/);
  assert.match(script, /chrome\.sidePanel\.open\(\{\s*tabId/);
  assert.match(script, /const shouldOpen = isLeetCodeProblemUrl\(url\) && openedTabs\.has\(tabId\)/);
  assert.match(script, /enabled:\s*shouldOpen/);
  assert.doesNotMatch(script, /if \(shouldOpen && chrome\.sidePanel\?\.open\)/);
  assert.doesNotMatch(script, /restoreSidePanelForTab[\s\S]*chrome\.sidePanel\.open\(\{\s*tabId\s*\}/);
  assert.match(script, /chrome\.tabs\.create\(\{\s*url:\s*LOCAL_BASE/);
  assert.match(script, /setDefaultSidePanelClosed/);
  assert.match(script, /chrome\.runtime\.onInstalled\.addListener/);
  assert.doesNotMatch(script, /chrome\.runtime\.onStartup/);
  assert.doesNotMatch(script, /^configureSidePanelDefaults\(\);/m);
  assert.match(script, /chrome\.tabs\.onUpdated/);
  assert.match(script, /chrome\.tabs\.onActivated/);
  assert.match(script, /ACCODER_PANEL_OPENED/);
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

  assert.match(script, /ACCODER_CAPTURE/);
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
  assert.match(script, /ACCODER_PANEL_OPENED/);
});

test("sidebar can run code through the local runner", () => {
  const html = fs.readFileSync("extension/sidebar.html", "utf8");
  const css = fs.readFileSync("extension/sidebar.css", "utf8");
  const script = fs.readFileSync("extension/sidebar.js", "utf8");

  assert.match(html, /id="runner"/);
  assert.match(html, /id="ac-count"/);
  assert.match(html, /value="local"/);
  assert.match(html, /value="docker"/);
  assert.match(script, /runCode/);
  assert.match(script, /api\/run/);
  assert.match(script, /sidebarWorkspaceKey/);
  assert.match(script, /runner:\s*"accoder\.sidebar\.runner"/);
  assert.match(script, /runner:\s*document\.querySelector\("#runner"\)/);
  assert.match(script, /runner:\s*elements\.runner\.value/);
  assert.match(script, /Running \$\{elements\.runner\.value\} runner/);
  assert.match(script, /body\.progress/);
  assert.match(script, /renderProgress/);
  assert.match(css, /\.ac-count/);
  assert.match(css, /\.run-status\.NO_RUNNER/);
});

test("sidebar shows runner environment status from the local doctor API", () => {
  const html = fs.readFileSync("extension/sidebar.html", "utf8");
  const css = fs.readFileSync("extension/sidebar.css", "utf8");
  const script = fs.readFileSync("extension/sidebar.js", "utf8");

  assert.match(html, /id="runner-health"/);
  assert.match(script, /api\/doctor/);
  assert.match(script, /recommendedRunnerByLanguage/);
  assert.match(script, /renderRunnerHealth/);
  assert.match(script, /missingCommands/);
  assert.match(css, /\.runner-health/);
  assert.match(css, /\.runner-health\.warn/);
});

test("sidebar explains Docker app uses its built-in environment", () => {
  const script = fs.readFileSync("extension/sidebar.js", "utf8");

  assert.match(script, /deployment\?\.mode === "docker-app"/);
  assert.match(script, /当前本地服务运行在 Docker app 容器中/);
  assert.match(script, /dockerOption\.disabled/);
});

test("sidebar exposes lightweight optional model advice through the local service", () => {
  const html = fs.readFileSync("extension/sidebar.html", "utf8");
  const css = fs.readFileSync("extension/sidebar.css", "utf8");
  const script = fs.readFileSync("extension/sidebar.js", "utf8");

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
  assert.match(script, /saveApiKey/);
  assert.match(css, /\.assist-panel/);
  assert.match(css, /\.assist-answer/);
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

test("sidebar editor skips over already inserted closing brackets", () => {
  const script = fs.readFileSync("extension/sidebar.js", "utf8");

  assert.match(script, /closingPairs/);
  assert.match(script, /handleEditorBeforeInput/);
  assert.match(script, /event\.inputType === "insertText"/);
  assert.match(script, /elements\.code\.value\[elements\.code\.selectionStart\] === event\.key/);
  assert.match(script, /elements\.code\.value\[elements\.code\.selectionStart\] === event\.data/);
  assert.match(script, /setSelectionRange\(elements\.code\.selectionStart \+ 1/);
  assert.match(script, /addEventListener\("beforeinput", handleEditorBeforeInput\)/);
});

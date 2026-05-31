import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

test("package and CLI use acmcoder naming", () => {
  const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));

  assert.equal(pkg.name, "acmcoder");
  assert.equal(pkg.bin.acmcoder, "./bin/acmcoder.js");
  assert.equal(pkg.scripts.cli, "node bin/acmcoder.js");
  assert.ok(fs.existsSync("bin/acmcoder.js"));
  assert.ok(!fs.existsSync("bin/accoder.js"));
});

test("documentation points users to the acmcoder repo and packages", () => {
  const readme = fs.readFileSync("README.md", "utf8");
  const compose = fs.readFileSync("docker-compose.prebuilt.yml", "utf8");
  const workflow = fs.readFileSync(".github/workflows/publish-images.yml", "utf8");

  assert.match(readme, /github\.com\/Pygmalion03\/acmcoder\.git/);
  assert.match(readme, /ghcr\.io\/pygmalion03\/acmcoder-app:latest/);
  assert.match(readme, /ghcr\.io\/pygmalion03\/acmcoder-runner:latest/);
  assert.match(compose, /ghcr\.io\/pygmalion03\/acmcoder-app:latest/);
  assert.match(workflow, /acmcoder-\$\{\{ matrix\.name \}\}/);
  assert.doesNotMatch(readme, /github\.com\/Pygmalion03\/accoder/);
  assert.doesNotMatch(compose, /accoder-/);
  assert.doesNotMatch(workflow, /accoder-/);
});

test("browser extension install docs cover Edge and Chrome manual loading", () => {
  const readme = fs.readFileSync("README.md", "utf8");
  const extensionDoc = fs.readFileSync("docs/edge-extension.md", "utf8");
  const combined = `${readme}\n${extensionDoc}`;

  assert.match(combined, /edge:\/\/extensions\//);
  assert.match(combined, /chrome:\/\/extensions\//);
  assert.match(combined, /Developer mode/i);
  assert.match(combined, /Load unpacked/i);
  assert.match(combined, /extension\//);
});

import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

test("repository includes a Docker app image for zero-local-toolchain users", () => {
  const dockerfile = fs.readFileSync("Dockerfile.app", "utf8");

  assert.match(dockerfile, /FROM\s+node/i);
  assert.match(dockerfile, /g\+\+/);
  assert.match(dockerfile, /openjdk/i);
  assert.match(dockerfile, /python3/);
  assert.match(dockerfile, /ACMCODER_HOST=0\.0\.0\.0/);
  assert.match(dockerfile, /bin\/acmcoder\.js/);
});

test("docker compose exposes the web server and persists local memory", () => {
  const compose = fs.readFileSync("docker-compose.yml", "utf8");

  assert.match(compose, /Dockerfile\.app/);
  assert.match(compose, /43117:43117/);
  assert.match(compose, /\.\/data\/memory:\/app\/data\/memory/);
});

test("repository publishes prebuilt full-language app and runner images through GitHub Actions", () => {
  const workflow = fs.readFileSync(".github/workflows/publish-images.yml", "utf8");

  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /tags:\s*\n\s*-\s*["']v\*["']/);
  assert.match(workflow, /packages:\s*write/);
  assert.match(workflow, /ghcr\.io/);
  assert.match(workflow, /name:\s*app[\s\S]*dockerfile:\s*Dockerfile\.app/);
  assert.match(workflow, /name:\s*runner[\s\S]*dockerfile:\s*Dockerfile\b/);
  assert.match(workflow, /linux\/amd64,linux\/arm64/);
});

test("prebuilt compose pulls the full-language app image without local build", () => {
  const compose = fs.readFileSync("docker-compose.prebuilt.yml", "utf8");

  assert.match(compose, /ghcr\.io\/pygmalion03\/acmcoder-app:latest/);
  assert.match(compose, /43117:43117/);
  assert.match(compose, /\.\/data\/memory:\/app\/data\/memory/);
  assert.doesNotMatch(compose, /\bbuild:/);
});

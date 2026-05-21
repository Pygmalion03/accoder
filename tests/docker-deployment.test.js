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

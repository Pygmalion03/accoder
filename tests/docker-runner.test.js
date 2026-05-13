import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import {
  buildDockerArgs,
  classifyDockerUnavailable,
  dockerRunner,
  shellQuote,
} from "../src/runner/docker-runner.js";

test("quotes shell arguments for bash -lc", () => {
  assert.equal(shellQuote("plain"), "'plain'");
  assert.equal(shellQuote("has space"), "'has space'");
  assert.equal(shellQuote("Bob's"), "'Bob'\"'\"'s'");
});

test("builds docker run arguments with resource limits and stdin", () => {
  const args = buildDockerArgs({
    hostWorkdir: "E:\\Projects\\acmcoder\\tmp",
    commandSpec: {
      command: "python",
      args: ["/workspace/main.py"],
    },
  });

  assert.deepEqual(args.slice(0, 2), ["run", "--rm"]);
  assert.ok(args.includes("-i"));
  assert.ok(args.includes("--network"));
  assert.ok(args.includes("none"));
  assert.ok(args.includes("--cpus"));
  assert.ok(args.includes("1"));
  assert.ok(args.includes("--memory"));
  assert.ok(args.includes("256m"));
  assert.ok(args.includes("--pids-limit"));
  assert.ok(args.includes("128"));
  assert.ok(args.includes("-w"));
  assert.ok(args.includes("/workspace"));
  assert.ok(args.includes("acmcoder-runner:local"));
  assert.equal(args.at(-3), "bash");
  assert.equal(args.at(-2), "-lc");
  assert.equal(args.at(-1), "'python' '/workspace/main.py'");
});

test("normalizes Windows-style workspace paths for the Linux container", () => {
  const args = buildDockerArgs({
    hostWorkdir: "E:\\Projects\\acmcoder\\tmp",
    commandSpec: {
      command: "\\workspace\\main.exe",
      args: [],
    },
  });

  assert.equal(args.at(-1), "'/workspace/main.exe'");
});

test("classifies missing docker command as unavailable runner", () => {
  const result = classifyDockerUnavailable({
    failedToStart: true,
    stderr: "spawn docker ENOENT",
  });

  assert.equal(result.status, "NO_RUNNER");
  assert.match(result.message, /Docker CLI is not available/);
});

test("classifies missing local image as unavailable runner", () => {
  const result = classifyDockerUnavailable({
    code: 125,
    stderr: "Unable to find image 'acmcoder-runner:local' locally\npull access denied",
  });

  assert.equal(result.status, "NO_RUNNER");
  assert.match(result.message, /docker build -t acmcoder-runner:local ./);
});

test("classifies stopped Docker Desktop daemon on Windows as unavailable runner", () => {
  const result = classifyDockerUnavailable({
    code: 1,
    stderr:
      "ERROR: failed to connect to the docker API at npipe:////./pipe/dockerDesktopLinuxEngine; check if the path is correct and if the daemon is running",
  });

  assert.equal(result.status, "NO_RUNNER");
  assert.match(result.message, /Docker daemon is not running/);
});

test("docker runner resolves paths inside the workspace", () => {
  assert.equal(dockerRunner.resolveSourceFile({ toolchain: { entryFile: "main.py" } }), "/workspace/main.py");
  assert.equal(dockerRunner.resolveWorkdir(), "/workspace");
});

test("repository includes a local docker runner image definition", () => {
  const dockerfile = fs.readFileSync("Dockerfile", "utf8");

  assert.match(dockerfile, /FROM/);
  assert.match(dockerfile, /openjdk|jdk/i);
  assert.match(dockerfile, /g\+\+/);
  assert.match(dockerfile, /python3/);
  assert.match(dockerfile, /\/usr\/local\/bin\/python/);
});

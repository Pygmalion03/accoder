import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import {
  buildDockerArgs,
  buildDockerImageArgs,
  classifyDockerUnavailable,
  dockerRunner,
  ensureDockerImage,
  getDockerImage,
  interpretDockerDoctorResult,
  shellQuote,
} from "../src/runner/docker-runner.js";
import { projectRoot } from "../src/core/problems.js";

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

test("uses configured Docker runner image when provided", () => {
  assert.equal(getDockerImage({}), "acmcoder-runner:local");
  assert.equal(getDockerImage({ ACMCODER_DOCKER_IMAGE: "ghcr.io/pygmalion03/acmcoder-runner:v2" }), "ghcr.io/pygmalion03/acmcoder-runner:v2");
});

test("builds docker run arguments with configured image", () => {
  const args = buildDockerArgs({
    hostWorkdir: "E:\\Projects\\acmcoder\\tmp",
    image: "custom/acmcoder-runner:test",
    commandSpec: {
      command: "python",
      args: ["/workspace/main.py"],
    },
  });

  assert.ok(args.includes("custom/acmcoder-runner:test"));
  assert.equal(args.includes("acmcoder-runner:local"), false);
});

test("builds docker image arguments", () => {
  assert.deepEqual(buildDockerImageArgs("custom/acmcoder-runner:test"), ["build", "-t", "custom/acmcoder-runner:test", "."]);
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

test("auto-builds missing Docker runner image before execution", async () => {
  const calls = [];
  const result = await dockerRunner.execute(
    {
      command: "python",
      args: ["/workspace/main.py"],
    },
    {
      hostWorkdir: "E:\\Projects\\acmcoder\\tmp",
      image: "acmcoder-runner:test-autobuild",
      runProcess: async (command, args, options = {}) => {
        calls.push({ command, args, options });
        if (args[0] === "image") {
          return { code: 1, stdout: "", stderr: "No such image: acmcoder-runner:test-autobuild" };
        }
        if (args[0] === "build") {
          return { code: 0, stdout: "built", stderr: "" };
        }
        return { code: 0, stdout: "ok", stderr: "" };
      },
    },
  );

  assert.equal(result.code, 0);
  assert.equal(result.stdout, "ok");
  assert.deepEqual(
    calls.map((call) => call.args[0]),
    ["image", "build", "run"],
  );
  assert.deepEqual(calls[1].args, ["build", "-t", "acmcoder-runner:test-autobuild", "."]);
  assert.equal(calls[1].options.cwd, projectRoot);
});

test("reports Docker image build failures as unavailable runner", async () => {
  const result = await ensureDockerImage({
    image: "acmcoder-runner:test-build-fail",
    runProcess: async (_command, args) => {
      if (args[0] === "image") {
        return { code: 1, stdout: "", stderr: "No such image: acmcoder-runner:test-build-fail" };
      }
      return { code: 1, stdout: "", stderr: "apt failed" };
    },
  });

  assert.equal(result.ready, false);
  assert.equal(result.result.status, "NO_RUNNER");
  assert.match(result.result.message, /Docker runner image build failed/);
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

test("interprets Docker doctor result when image is ready", () => {
  const result = interpretDockerDoctorResult({
    image: "acmcoder-runner:local",
    dockerResult: { code: 0, stdout: "29.2.1\n", stderr: "" },
    imageResult: { code: 0, stdout: "[]", stderr: "" },
  });

  assert.equal(result.ready, true);
  assert.match(result.message, /image acmcoder-runner:local/);
});

test("interprets Docker doctor result when image is missing but auto-build is enabled", () => {
  const result = interpretDockerDoctorResult({
    image: "acmcoder-runner:local",
    dockerResult: { code: 0, stdout: "29.2.1\n", stderr: "" },
    imageResult: { code: 1, stdout: "", stderr: "No such image: acmcoder-runner:local" },
  });

  assert.equal(result.ready, true);
  assert.match(result.message, /will be built automatically/);
});

test("interprets Docker doctor result when image is missing and auto-build is disabled", () => {
  const result = interpretDockerDoctorResult({
    image: "acmcoder-runner:local",
    dockerResult: { code: 0, stdout: "29.2.1\n", stderr: "" },
    imageResult: { code: 1, stdout: "", stderr: "No such image: acmcoder-runner:local" },
    env: { ACMCODER_DOCKER_AUTO_BUILD: "0" },
  });

  assert.equal(result.ready, false);
  assert.match(result.message, /docker build -t acmcoder-runner:local ./);
});

test("interprets Docker doctor result when daemon is unavailable", () => {
  const result = interpretDockerDoctorResult({
    image: "acmcoder-runner:local",
    dockerResult: {
      code: 1,
      stdout: "",
      stderr: "Cannot connect to the Docker daemon",
    },
    imageResult: null,
  });

  assert.equal(result.ready, false);
  assert.match(result.message, /Docker daemon is not running/);
});

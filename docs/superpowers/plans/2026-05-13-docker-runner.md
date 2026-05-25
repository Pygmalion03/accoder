# Docker Runner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an explicit Docker runner mode so users without local Java/C++/Python toolchains can compile and run submissions through a locally built Docker image.

**Architecture:** Keep `runSubmission()` as the public orchestration API, but move process execution behind runner adapters. `local` keeps the existing host-toolchain behavior; `docker` maps the same toolchain commands into `/workspace` and executes them through `docker run` with resource limits.

**Tech Stack:** Node.js ESM, built-in `node:test`, Docker CLI, local Dockerfile image `accoder-runner:local`, existing Web/CLI/server code.

---

## File Structure

- Create `src/runner/process.js`: shared `spawn` wrapper with timeout, stdin, stdout/stderr decoding.
- Create `src/runner/local-runner.js`: host execution adapter.
- Create `src/runner/docker-runner.js`: Docker command builder, Docker error classifier, Docker execution adapter.
- Create `src/runner/runners.js`: runner constants, validation, adapter lookup.
- Modify `src/runner/run.js`: use selected runner adapter and keep comparison/status logic centralized.
- Modify `bin/accoder.js`: pass optional `--runner` into `runProblemCases()` and `runSubmission()`.
- Modify `src/server/server.js`: allow `/api/run` to pass `runner`; add a test injection hook for run behavior.
- Modify `web/index.html`, `web/app.js`, `web/styles.css`: add `Local` / `Docker` selector and send it in run requests.
- Create `tests/runners.test.js`: runner selection and default behavior.
- Create `tests/docker-runner.test.js`: Docker command arguments, shell quoting, unavailable-runner classification.
- Modify `tests/server.test.js`, `tests/cli-args.test.js`, `tests/web-copy.test.js`: cover runner propagation.
- Create `Dockerfile`: local runner image with JDK, g++, Python 3, bash.
- Modify `README.md`: document Docker build and `--runner docker`.

---

### Task 1: Add Runner Selection And Preserve Local Default

**Files:**
- Create: `src/runner/runners.js`
- Create: `src/runner/process.js`
- Create: `src/runner/local-runner.js`
- Modify: `src/runner/run.js`
- Test: `tests/runners.test.js`

- [ ] **Step 1: Write the failing runner-selection tests**

Add `tests/runners.test.js`:

```js
import test from "node:test";
import assert from "node:assert/strict";

import { DEFAULT_RUNNER, getRunner, normalizeRunner } from "../src/runner/runners.js";

test("defaults to local runner when no runner is provided", () => {
  assert.equal(DEFAULT_RUNNER, "local");
  assert.equal(normalizeRunner(undefined), "local");
  assert.equal(normalizeRunner(""), "local");
});

test("accepts local and docker runner names", () => {
  assert.equal(normalizeRunner("local"), "local");
  assert.equal(normalizeRunner("docker"), "docker");
  assert.equal(getRunner("local").name, "local");
  assert.equal(getRunner("docker").name, "docker");
});

test("rejects unsupported runner names with a clear error", () => {
  assert.throws(() => normalizeRunner("podman"), /Unsupported runner: podman/);
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```bash
node --test tests/runners.test.js
```

Expected: fails because `src/runner/runners.js` does not exist.

- [ ] **Step 3: Extract the shared process runner**

Create `src/runner/process.js` by moving the existing `runProcess()` implementation out of `src/runner/run.js`:

```js
import { spawn } from "node:child_process";

import { decodeProcessOutput } from "./encoding.js";

export const DEFAULT_TIMEOUT_MS = 3000;

export function runProcess(command, args, options = {}) {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    });

    const stdoutChunks = [];
    const stderrChunks = [];
    let settled = false;

    const buildResult = (extra = {}) => ({
      code: null,
      stdout: decodeProcessOutput(stdoutChunks),
      stderr: decodeProcessOutput(stderrChunks),
      timedOut: false,
      ...extra,
    });

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill("SIGKILL");
      resolve(buildResult({ timedOut: true }));
    }, timeoutMs);

    child.stdout.on("data", (chunk) => stdoutChunks.push(chunk));
    child.stderr.on("data", (chunk) => stderrChunks.push(chunk));

    child.once("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(buildResult({ stderr: error.message, failedToStart: true }));
    });

    child.once("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(buildResult({ code, timedOut: false }));
    });

    child.stdin.end(options.stdin ?? "");
  });
}
```

- [ ] **Step 4: Add the local runner adapter**

Create `src/runner/local-runner.js`:

```js
import { runProcess } from "./process.js";

export const localRunner = {
  name: "local",
  resolveSourceFile({ sourceFile }) {
    return sourceFile;
  },
  resolveWorkdir({ workdir }) {
    return workdir;
  },
  async execute(commandSpec, options = {}) {
    return runProcess(commandSpec.command, commandSpec.args, {
      cwd: options.hostWorkdir,
      stdin: options.stdin,
      timeoutMs: options.timeoutMs,
    });
  },
};
```

- [ ] **Step 5: Add the runner registry with a temporary Docker placeholder**

Create `src/runner/runners.js`:

```js
import { localRunner } from "./local-runner.js";

const dockerRunnerPlaceholder = {
  name: "docker",
  resolveSourceFile({ toolchain }) {
    return `/workspace/${toolchain.entryFile}`;
  },
  resolveWorkdir() {
    return "/workspace";
  },
  async execute() {
    return {
      status: "NO_RUNNER",
      runnerUnavailable: true,
      message: "Docker runner is not implemented yet.",
      stdout: "",
      stderr: "",
    };
  },
};

export const DEFAULT_RUNNER = "local";

const runners = {
  local: localRunner,
  docker: dockerRunnerPlaceholder,
};

export function normalizeRunner(value) {
  const runner = String(value || DEFAULT_RUNNER).toLowerCase();
  if (!runners[runner]) {
    throw new Error(`Unsupported runner: ${value}. Supported runners: ${Object.keys(runners).join(", ")}`);
  }
  return runner;
}

export function getRunner(value) {
  return runners[normalizeRunner(value)];
}
```

- [ ] **Step 6: Update `runSubmission()` to use runner adapters**

Modify `src/runner/run.js` so it imports `DEFAULT_TIMEOUT_MS` from `process.js`, removes the inline `runProcess()`, and uses `getRunner(options.runner)`. The command context must be resolved before calling toolchain compile/run:

```js
const runner = getRunner(options.runner);
const executionSourceFile = runner.resolveSourceFile({ sourceFile, workdir, toolchain });
const executionWorkdir = runner.resolveWorkdir({ sourceFile, workdir, toolchain });
```

Compile and run calls should go through:

```js
const compileResult = await runner.execute(compileCommand, {
  hostWorkdir: workdir,
  stdin: "",
  timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
});
```

If a runner returns `runnerUnavailable`, return:

```js
{
  status: "NO_RUNNER",
  message: result.message,
  stdout: result.stdout,
  stderr: result.stderr,
}
```

- [ ] **Step 7: Run the focused and existing runner tests**

Run:

```bash
node --test tests/runners.test.js tests/toolchains.test.js tests/output.test.js
```

Expected: all selected tests pass.

- [ ] **Step 8: Commit Task 1**

```bash
git add src/runner/process.js src/runner/local-runner.js src/runner/runners.js src/runner/run.js tests/runners.test.js
git commit -m "Add runner adapter selection"
```

---

### Task 2: Implement Docker Runner Command Building And Error Classification

**Files:**
- Create: `src/runner/docker-runner.js`
- Modify: `src/runner/runners.js`
- Test: `tests/docker-runner.test.js`

- [ ] **Step 1: Write Docker runner unit tests**

Add `tests/docker-runner.test.js`:

```js
import test from "node:test";
import assert from "node:assert/strict";

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
    hostWorkdir: "E:\\Projects\\accoder\\tmp",
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
  assert.ok(args.includes("accoder-runner:local"));
  assert.equal(args.at(-3), "bash");
  assert.equal(args.at(-2), "-lc");
  assert.equal(args.at(-1), "'python' '/workspace/main.py'");
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
    stderr: "Unable to find image 'accoder-runner:local' locally\npull access denied",
  });

  assert.equal(result.status, "NO_RUNNER");
  assert.match(result.message, /docker build -t accoder-runner:local ./);
});

test("docker runner resolves paths inside the workspace", () => {
  assert.equal(dockerRunner.resolveSourceFile({ toolchain: { entryFile: "main.py" } }), "/workspace/main.py");
  assert.equal(dockerRunner.resolveWorkdir(), "/workspace");
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```bash
node --test tests/docker-runner.test.js
```

Expected: fails because `src/runner/docker-runner.js` does not exist.

- [ ] **Step 3: Implement Docker command builder and classifier**

Create `src/runner/docker-runner.js`:

```js
import { runProcess } from "./process.js";

export const DOCKER_IMAGE = "accoder-runner:local";
export const DOCKER_WORKDIR = "/workspace";

export function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'\"'\"'`)}'`;
}

export function buildShellCommand(commandSpec) {
  return [commandSpec.command, ...commandSpec.args].map(shellQuote).join(" ");
}

export function buildDockerArgs({ hostWorkdir, commandSpec, image = DOCKER_IMAGE }) {
  return [
    "run",
    "--rm",
    "-i",
    "--network",
    "none",
    "--cpus",
    "1",
    "--memory",
    "256m",
    "--pids-limit",
    "128",
    "-v",
    `${hostWorkdir}:${DOCKER_WORKDIR}`,
    "-w",
    DOCKER_WORKDIR,
    image,
    "bash",
    "-lc",
    buildShellCommand(commandSpec),
  ];
}

export function classifyDockerUnavailable(result) {
  if (result.failedToStart) {
    return {
      status: "NO_RUNNER",
      message: "Docker CLI is not available. Install Docker Desktop and make sure the docker command is on PATH.",
    };
  }

  const stderr = result.stderr || "";
  if (/Cannot connect to the Docker daemon|docker daemon is not running|error during connect/i.test(stderr)) {
    return {
      status: "NO_RUNNER",
      message: "Docker daemon is not running. Start Docker Desktop and try again.",
    };
  }

  if (/Unable to find image|pull access denied|repository does not exist/i.test(stderr)) {
    return {
      status: "NO_RUNNER",
      message: "Docker runner image is missing. Run: docker build -t accoder-runner:local .",
    };
  }

  if (result.code === 125) {
    return {
      status: "NO_RUNNER",
      message: "Docker runner failed to start. Check Docker Desktop and the accoder-runner:local image.",
    };
  }

  return null;
}

export const dockerRunner = {
  name: "docker",
  resolveSourceFile({ toolchain }) {
    return `${DOCKER_WORKDIR}/${toolchain.entryFile}`;
  },
  resolveWorkdir() {
    return DOCKER_WORKDIR;
  },
  async execute(commandSpec, options = {}) {
    const dockerArgs = buildDockerArgs({
      hostWorkdir: options.hostWorkdir,
      commandSpec,
    });
    const result = await runProcess("docker", dockerArgs, {
      stdin: options.stdin,
      timeoutMs: options.timeoutMs,
    });
    const unavailable = classifyDockerUnavailable(result);
    return unavailable ? { ...result, ...unavailable, runnerUnavailable: true } : result;
  },
};
```

- [ ] **Step 4: Register the real Docker runner**

Modify `src/runner/runners.js` to import and register `dockerRunner`:

```js
import { dockerRunner } from "./docker-runner.js";
import { localRunner } from "./local-runner.js";

export const DEFAULT_RUNNER = "local";

const runners = {
  local: localRunner,
  docker: dockerRunner,
};
```

- [ ] **Step 5: Run Docker runner tests**

Run:

```bash
node --test tests/docker-runner.test.js tests/runners.test.js
```

Expected: all selected tests pass.

- [ ] **Step 6: Commit Task 2**

```bash
git add src/runner/docker-runner.js src/runner/runners.js tests/docker-runner.test.js
git commit -m "Add docker runner adapter"
```

---

### Task 3: Wire Runner Mode Through CLI And Server API

**Files:**
- Modify: `bin/accoder.js`
- Modify: `src/server/server.js`
- Modify: `tests/cli-args.test.js`
- Modify: `tests/server.test.js`

- [ ] **Step 1: Add CLI parse coverage**

Append to `tests/cli-args.test.js`:

```js
test("parses optional runner mode", () => {
  assert.deepEqual(parseCliArgs(["test", "two-sum", "--lang", "python", "--file", "main.py", "--runner", "docker"]), {
    command: "test",
    positional: ["two-sum"],
    options: {
      lang: "python",
      file: "main.py",
      runner: "docker",
    },
  });
});
```

- [ ] **Step 2: Add server runner propagation coverage**

Append to `tests/server.test.js`:

```js
test("passes runner mode from run API into the runner layer", async () => {
  const calls = [];
  const server = createAccoderServer({
    runSubmission: async (options) => {
      calls.push(options);
      return {
        status: "UNKNOWN",
        message: "captured",
        stdout: "",
        stderr: "",
      };
    },
  });
  const port = await listen(server);

  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/run`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        language: "python",
        code: "print(1)",
        stdin: "",
        expected: "",
        runner: "docker",
      }),
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.result.message, "captured");
    assert.equal(calls[0].runner, "docker");
  } finally {
    server.close();
  }
});
```

- [ ] **Step 3: Run the focused tests and verify server test fails**

Run:

```bash
node --test tests/cli-args.test.js tests/server.test.js
```

Expected: CLI parse test passes because parser is generic; server test fails until `createAccoderServer()` supports injected `runSubmission`.

- [ ] **Step 4: Pass runner through CLI**

In `bin/accoder.js`, update help text:

```text
node bin/accoder.js test <slug> --lang <java|cpp|python> --file <path> [--runner <local|docker>]
node bin/accoder.js run <slug> --lang <java|cpp|python> --file <path> --input <path> [--expected <path>] [--runner <local|docker>]
```

Update `test` command call:

```js
const results = await runProblemCases({ slug, language, file, runner: parsed.options.runner });
```

Update `run` command call:

```js
const result = await runSubmission({ language, file, stdin, expected, runner: parsed.options.runner });
```

Add `NO_RUNNER` to failure exit statuses:

```js
if (["WA", "RE", "CE", "TLE", "NO_TOOLCHAIN", "NO_RUNNER"].includes(result.status)) {
  process.exitCode = 1;
}
```

- [ ] **Step 5: Pass runner through server with an injection hook**

Modify `src/server/server.js`:

```js
import { runSubmission as defaultRunSubmission } from "../runner/run.js";
```

Inside `createAccoderServer(options = {})`:

```js
const runSubmission = options.runSubmission || defaultRunSubmission;
```

Inside `/api/run`:

```js
const result = await runSubmission({
  language: body.language,
  code: body.code,
  stdin: body.stdin,
  expected: body.expected,
  timeoutMs: body.timeoutMs,
  runner: body.runner,
});
```

- [ ] **Step 6: Run the focused tests**

Run:

```bash
node --test tests/cli-args.test.js tests/server.test.js
```

Expected: selected tests pass.

- [ ] **Step 7: Commit Task 3**

```bash
git add bin/accoder.js src/server/server.js tests/cli-args.test.js tests/server.test.js
git commit -m "Wire runner mode through CLI and API"
```

---

### Task 4: Add Web Runner Selector

**Files:**
- Modify: `web/index.html`
- Modify: `web/app.js`
- Modify: `web/styles.css`
- Modify: `tests/web-copy.test.js`

- [ ] **Step 1: Add Web copy tests**

Append to `tests/web-copy.test.js`:

```js
test("web UI exposes local and docker runner modes", () => {
  const html = fs.readFileSync("web/index.html", "utf8");
  const script = fs.readFileSync("web/app.js", "utf8");
  const css = fs.readFileSync("web/styles.css", "utf8");

  assert.match(html, /id="runner"/);
  assert.match(html, /value="local"/);
  assert.match(html, /value="docker"/);
  assert.match(script, /runner:\s*document\.querySelector\("#runner"\)/);
  assert.match(script, /runner:\s*elements\.runner\.value/);
  assert.match(script, /accoder\.web\.runner/);
  assert.match(css, /\.status\.NO_RUNNER/);
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```bash
node --test tests/web-copy.test.js
```

Expected: fails because the runner selector is not present.

- [ ] **Step 3: Add runner selector to toolbar**

In `web/index.html`, add this label after the language selector:

```html
<label>
  运行模式
  <select id="runner">
    <option value="local">Local</option>
    <option value="docker">Docker</option>
  </select>
</label>
```

- [ ] **Step 4: Persist and send runner mode in Web app**

In `web/app.js`, add cache key:

```js
runner: "accoder.web.runner",
```

Add element:

```js
runner: document.querySelector("#runner"),
```

In `init()` load and listen:

```js
elements.runner.value = localStorage.getItem(CACHE_KEYS.runner) || elements.runner.value;
elements.runner.addEventListener("change", () => {
  localStorage.setItem(CACHE_KEYS.runner, elements.runner.value);
});
```

In `runCode()` message and body:

```js
elements.message.textContent = `Running ${elements.runner.value} runner...`;
```

```js
runner: elements.runner.value,
```

- [ ] **Step 5: Update toolbar CSS and NO_RUNNER styling**

In `web/styles.css`, change toolbar columns to fit two selectors:

```css
.toolbar {
  display: grid;
  grid-template-columns: minmax(120px, 0.8fr) minmax(120px, 0.8fr) auto auto;
  gap: 10px;
  align-items: end;
}
```

Add `NO_RUNNER` to the failure status selector:

```css
.status.WA,
.status.RE,
.status.CE,
.status.TLE,
.status.NO_TOOLCHAIN,
.status.NO_RUNNER {
  background: #f3d8d8;
  color: var(--bad);
}
```

- [ ] **Step 6: Run Web tests**

Run:

```bash
node --test tests/web-copy.test.js
```

Expected: tests pass.

- [ ] **Step 7: Commit Task 4**

```bash
git add web/index.html web/app.js web/styles.css tests/web-copy.test.js
git commit -m "Add web runner mode selector"
```

---

### Task 5: Add Dockerfile And Usage Documentation

**Files:**
- Create: `Dockerfile`
- Modify: `README.md`
- Test: `tests/docker-runner.test.js`

- [ ] **Step 1: Add Dockerfile presence test**

Append to `tests/docker-runner.test.js`:

```js
import fs from "node:fs";

test("repository includes a local docker runner image definition", () => {
  const dockerfile = fs.readFileSync("Dockerfile", "utf8");

  assert.match(dockerfile, /FROM/);
  assert.match(dockerfile, /openjdk|jdk/i);
  assert.match(dockerfile, /g\+\+/);
  assert.match(dockerfile, /python3/);
});
```

- [ ] **Step 2: Run focused test and verify it fails**

Run:

```bash
node --test tests/docker-runner.test.js
```

Expected: fails because `Dockerfile` does not exist.

- [ ] **Step 3: Add Dockerfile**

Create `Dockerfile`:

```dockerfile
FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    bash \
    ca-certificates \
    g++ \
    openjdk-21-jdk-headless \
    python3 \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /workspace
```

- [ ] **Step 4: Document Docker usage**

In `README.md`, add a Docker runner section after the local Web instructions:

````markdown
## Docker runner

如果本机没有 Java、C++ 或 Python 工具链，但已经安装 Docker，可以先构建本地 runner 镜像：

```bash
docker build -t accoder-runner:local .
```

然后在 CLI 中显式选择 Docker：

```bash
node bin/accoder.js test two-sum --lang python --file problems/two-sum/templates/main.py --runner docker
```

Web 页面也可以在运行模式里选择 Docker。Docker 模式会禁用容器网络，并限制 CPU、内存和进程数量。
````

- [ ] **Step 5: Run focused tests**

Run:

```bash
node --test tests/docker-runner.test.js
```

Expected: tests pass.

- [ ] **Step 6: Commit Task 5**

```bash
git add Dockerfile README.md tests/docker-runner.test.js
git commit -m "Document local docker runner image"
```

---

### Task 6: Final Verification

**Files:**
- Verify all changed files.

- [ ] **Step 1: Run the full test suite**

Run:

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 2: Check git status**

Run:

```bash
git status -sb
```

Expected: clean working tree on `v1`, ahead of `origin/v1` by the implementation commits.

- [ ] **Step 3: Optional manual Docker smoke test when Docker is available**

Run:

```bash
docker build -t accoder-runner:local .
node bin/accoder.js test two-sum --lang python --file problems/two-sum/templates/main.py --runner docker
```

Expected: build succeeds and the sample case returns `AC`. If Docker is unavailable in the current machine, record that only non-Docker unit tests were run.

- [ ] **Step 4: Prepare final summary**

Summarize:

```text
Implemented explicit local/docker runner selection.
Docker runner uses accoder-runner:local with network, CPU, memory, and PID limits.
CLI, API, and Web all pass runner mode through the same runner layer.
Validation: npm test, plus Docker smoke test if available.
```

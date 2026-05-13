import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

import { compareOutput } from "../core/output.js";
import { findProblem, resolveProjectPath } from "../core/problems.js";
import { decodeProcessOutput } from "./encoding.js";
import { getToolchain } from "./toolchains.js";

const DEFAULT_TIMEOUT_MS = 3000;

function runProcess(command, args, options = {}) {
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

    child.stdout.on("data", (chunk) => {
      stdoutChunks.push(chunk);
    });

    child.stderr.on("data", (chunk) => {
      stderrChunks.push(chunk);
    });

    child.once("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({
        ...buildResult({
        stderr: error.message,
        failedToStart: true,
        }),
      });
    });

    child.once("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(buildResult({
        code,
        timedOut: false,
      }));
    });

    child.stdin.end(options.stdin ?? "");
  });
}

async function prepareSource({ toolchain, file, code, workdir }) {
  const sourceFile = path.join(workdir, toolchain.entryFile);

  if (code !== undefined) {
    await fs.writeFile(sourceFile, String(code), "utf8");
    return sourceFile;
  }

  if (!file) {
    throw new Error("A source file or code string is required.");
  }

  await fs.copyFile(path.resolve(file), sourceFile);
  return sourceFile;
}

export async function runSubmission(options) {
  const toolchain = getToolchain(options.language);
  const workdir = await fs.mkdtemp(path.join(os.tmpdir(), "acmcoder-"));

  try {
    const sourceFile = await prepareSource({
      toolchain,
      file: options.file,
      code: options.code,
      workdir,
    });

    if (toolchain.compile) {
      const compileCommand = toolchain.compile({ sourceFile, workdir });
      const compileResult = await runProcess(compileCommand.command, compileCommand.args, {
        cwd: workdir,
        timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      });

      if (compileResult.failedToStart) {
        return {
          status: "NO_TOOLCHAIN",
          message: `Cannot start ${compileCommand.command}. Is the toolchain installed?`,
          stdout: compileResult.stdout,
          stderr: compileResult.stderr,
        };
      }

      if (compileResult.timedOut) {
        return {
          status: "TLE",
          message: "Compilation timed out.",
          stdout: compileResult.stdout,
          stderr: compileResult.stderr,
        };
      }

      if (compileResult.code !== 0) {
        return {
          status: "CE",
          message: "Compilation failed.",
          stdout: compileResult.stdout,
          stderr: compileResult.stderr,
        };
      }
    }

    const runCommand = toolchain.run({ sourceFile, workdir });
    const runResult = await runProcess(runCommand.command, runCommand.args, {
      cwd: workdir,
      stdin: options.stdin ?? "",
      timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    });

    if (runResult.failedToStart) {
      return {
        status: "NO_TOOLCHAIN",
        message: `Cannot start ${runCommand.command}. Is the toolchain installed?`,
        stdout: runResult.stdout,
        stderr: runResult.stderr,
      };
    }

    if (runResult.timedOut) {
      return {
        status: "TLE",
        message: "Execution timed out.",
        stdout: runResult.stdout,
        stderr: runResult.stderr,
      };
    }

    if (runResult.code !== 0) {
      return {
        status: "RE",
        message: `Runtime error. Exit code: ${runResult.code}`,
        stdout: runResult.stdout,
        stderr: runResult.stderr,
      };
    }

    if (options.expected !== undefined && options.expected !== null && String(options.expected).length > 0) {
      const comparison = compareOutput(runResult.stdout, options.expected);
      return {
        ...comparison,
        stdout: runResult.stdout,
        stderr: runResult.stderr,
      };
    }

    return {
      status: "UNKNOWN",
      message: "Finished without expected output.",
      stdout: runResult.stdout,
      stderr: runResult.stderr,
    };
  } finally {
    await fs.rm(workdir, { recursive: true, force: true });
  }
}

export async function runProblemCases({ slug, language, file, code, timeoutMs }) {
  const problem = findProblem(slug);
  const results = [];

  for (const [index, testCase] of problem.cases.entries()) {
    const stdin = await fs.readFile(resolveProjectPath(testCase.input), "utf8");
    const expected = await fs.readFile(resolveProjectPath(testCase.output), "utf8");
    const result = await runSubmission({
      language,
      file,
      code,
      stdin,
      expected,
      timeoutMs,
    });

    results.push({
      index: index + 1,
      name: testCase.name,
      ...result,
    });
  }

  return results;
}

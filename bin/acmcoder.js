#!/usr/bin/env node
import fs from "node:fs/promises";

import { findProblem, loadProblems } from "../src/core/problems.js";
import { parseCliArgs, requireOption } from "../src/cli/args.js";
import { checkToolchain, listLanguages } from "../src/runner/toolchains.js";
import { runProblemCases, runSubmission } from "../src/runner/run.js";
import { startServer } from "../src/server/server.js";

function printHelp() {
  console.log(`ACMCoder

Usage:
  node bin/acmcoder.js list
  node bin/acmcoder.js show <slug-or-id>
  node bin/acmcoder.js doctor
  node bin/acmcoder.js test <slug> --lang <java|cpp|python> --file <path>
  node bin/acmcoder.js run <slug> --lang <java|cpp|python> --file <path> --input <path> [--expected <path>]
  node bin/acmcoder.js serve [--port 43117]
`);
}

function printProblem(problem) {
  console.log(`#${problem.frontendId} ${problem.title} (${problem.slug})`);
  console.log(`Difficulty: ${problem.difficulty}`);
  console.log(`Tags: ${problem.tags.join(", ")}`);
  console.log(`Frequency: ${problem.rank.frequency} (${problem.rank.source})`);
  console.log(`LeetCode: ${problem.leetcode.url}`);
  console.log("");
  console.log("Input:");
  console.log(problem.acm.inputFormat);
  console.log("");
  console.log("Output:");
  console.log(problem.acm.outputFormat);
  if (problem.acm.notes) {
    console.log("");
    console.log(`Notes: ${problem.acm.notes}`);
  }
}

function printRunResult(result) {
  console.log(`[${result.status}] ${result.message}`);
  if (result.stdout) {
    console.log("\nstdout:");
    console.log(result.stdout.trimEnd());
  }
  if (result.stderr) {
    console.log("\nstderr:");
    console.log(result.stderr.trimEnd());
  }
}

async function main() {
  const parsed = parseCliArgs(process.argv.slice(2));

  if (parsed.command === "help" || parsed.command === "--help" || parsed.command === "-h") {
    printHelp();
    return;
  }

  if (parsed.command === "list") {
    for (const problem of loadProblems()) {
      console.log(
        `${problem.frontendId.padStart(4, " ")}  ${problem.slug.padEnd(36, " ")} ${problem.difficulty.padEnd(6, " ")} ${problem.rank.frequency}`,
      );
    }
    return;
  }

  if (parsed.command === "show") {
    const slug = parsed.positional[0];
    if (!slug) throw new Error("Usage: show <slug-or-id>");
    printProblem(findProblem(slug));
    return;
  }

  if (parsed.command === "doctor") {
    for (const language of listLanguages()) {
      const result = await checkToolchain(language);
      const mark = result.ready ? "OK" : "MISSING";
      console.log(`${mark.padEnd(8, " ")} ${result.label}: ${result.checks.map((item) => item.command).join(", ")}`);
    }
    return;
  }

  if (parsed.command === "test") {
    const slug = parsed.positional[0];
    if (!slug) throw new Error("Usage: test <slug> --lang <lang> --file <path>");
    const language = requireOption(parsed.options, "lang");
    const file = requireOption(parsed.options, "file");
    const results = await runProblemCases({ slug, language, file });

    for (const result of results) {
      console.log(`case ${result.index} (${result.name}): ${result.status} - ${result.message}`);
      if (result.stderr) console.log(result.stderr.trimEnd());
    }

    if (results.some((result) => result.status !== "AC")) {
      process.exitCode = 1;
    }
    return;
  }

  if (parsed.command === "run") {
    const slug = parsed.positional[0];
    if (!slug) throw new Error("Usage: run <slug> --lang <lang> --file <path> --input <path> [--expected <path>]");
    findProblem(slug);
    const language = requireOption(parsed.options, "lang");
    const file = requireOption(parsed.options, "file");
    const stdin = await fs.readFile(requireOption(parsed.options, "input"), "utf8");
    const expected = parsed.options.expected ? await fs.readFile(parsed.options.expected, "utf8") : undefined;
    const result = await runSubmission({ language, file, stdin, expected });

    printRunResult(result);
    if (["WA", "RE", "CE", "TLE", "NO_TOOLCHAIN"].includes(result.status)) {
      process.exitCode = 1;
    }
    return;
  }

  if (parsed.command === "serve") {
    startServer(Number(parsed.options.port || process.env.PORT || 43117));
    return;
  }

  throw new Error(`Unknown command: ${parsed.command}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});

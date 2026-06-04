import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

import { findProblem, loadProblems } from "../src/core/problems.js";

test("loads seeded ACM problems", () => {
  const problems = loadProblems();

  assert.equal(problems.length, 5);
  assert.deepEqual(
    problems.map((problem) => problem.frontendId),
    ["3", "146", "206", "215", "25"],
  );
});

test("finds a problem by slug or frontend id", () => {
  assert.equal(findProblem("reverse-linked-list").title, "反转链表");
  assert.equal(findProblem("206").slug, "reverse-linked-list");
});

test("exposes problem-facing descriptions instead of only runner metadata", () => {
  const problem = findProblem("longest-substring-without-repeating-characters");

  assert.match(problem.description, /无重复字符/);
  assert.match(problem.inputDescription, /字符串/);
  assert.match(problem.outputDescription, /LeetCode 返回值/);
  assert.match(problem.exampleExplanation, /abcabcbb/);
});

test("seed problems share simple templates instead of bundled answers", () => {
  const slugs = loadProblems().map((problem) => problem.slug);
  const files = {
    python: "main.py",
    java: "Main.java",
    cpp: "main.cpp",
  };

  for (const fileName of Object.values(files)) {
    const templates = slugs.map((slug) => fs.readFileSync(`problems/${slug}/templates/${fileName}`, "utf8"));

    assert.equal(new Set(templates).size, 1);
    assert.match(templates[0], /TODO/);
  }

  const javaTemplate = fs.readFileSync("problems/reverse-linked-list/templates/Main.java", "utf8");
  assert.match(javaTemplate, /import java\.util\.Scanner/);
  assert.match(javaTemplate, /Scanner sc = new Scanner\(System\.in\)/);
  assert.doesNotMatch(javaTemplate, /BufferedReader/);
  assert.doesNotMatch(javaTemplate, /InputStreamReader/);
});

test("throws a clear error for an unknown problem", () => {
  assert.throws(() => findProblem("missing-problem"), /Unknown problem/);
});

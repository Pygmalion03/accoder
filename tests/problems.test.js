import test from "node:test";
import assert from "node:assert/strict";

import { findProblem, loadProblems } from "../src/core/problems.js";

test("loads seeded ACM problems", () => {
  const problems = loadProblems();

  assert.equal(problems.length, 5);
  assert.equal(problems[0].slug, "two-sum");
});

test("finds a problem by slug or frontend id", () => {
  assert.equal(findProblem("two-sum").title, "两数之和");
  assert.equal(findProblem("1").slug, "two-sum");
});

test("exposes problem-facing descriptions instead of only runner metadata", () => {
  const problem = findProblem("two-sum");

  assert.match(problem.description, /整数数组 nums/);
  assert.match(problem.inputDescription, /第一行/);
  assert.match(problem.outputDescription, /LeetCode 返回值/);
  assert.match(problem.exampleExplanation, /n = 4/);
});

test("throws a clear error for an unknown problem", () => {
  assert.throws(() => findProblem("missing-problem"), /Unknown problem/);
});

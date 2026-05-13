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

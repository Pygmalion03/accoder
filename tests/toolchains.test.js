import test from "node:test";
import assert from "node:assert/strict";

import { getToolchain, listLanguages } from "../src/runner/toolchains.js";

test("lists the first-version languages", () => {
  assert.deepEqual(listLanguages(), ["java", "cpp", "python"]);
});

test("returns compile and run metadata for Java", () => {
  const toolchain = getToolchain("java");

  assert.equal(toolchain.extension, ".java");
  assert.equal(toolchain.entryFile, "Main.java");
  assert.equal(typeof toolchain.compile, "function");
  assert.equal(typeof toolchain.run, "function");
});

test("compiles Java source as utf-8", () => {
  const command = getToolchain("java").compile({
    sourceFile: "Main.java",
  });

  assert.deepEqual(command.args.slice(0, 3), ["-encoding", "UTF-8", "Main.java"]);
});

test("rejects unsupported languages with a clear error", () => {
  assert.throws(() => getToolchain("ruby"), /Unsupported language/);
});

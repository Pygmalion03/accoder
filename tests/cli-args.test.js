import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import { parseCliArgs } from "../src/cli/args.js";

test("parses list command", () => {
  assert.deepEqual(parseCliArgs(["list"]), {
    command: "list",
    positional: [],
    options: {},
  });
});

test("parses test command options", () => {
  assert.deepEqual(parseCliArgs(["test", "two-sum", "--lang", "python", "--file", "main.py"]), {
    command: "test",
    positional: ["two-sum"],
    options: {
      lang: "python",
      file: "main.py",
    },
  });
});

test("rejects options without values", () => {
  assert.throws(() => parseCliArgs(["test", "two-sum", "--lang"]), /Missing value/);
});

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

test("doctor reports Docker runner status", () => {
  const script = fs.readFileSync("bin/acmcoder.js", "utf8");

  assert.match(script, /checkDockerRunner/);
  assert.match(script, /Docker runner:/);
});

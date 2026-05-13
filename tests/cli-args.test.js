import test from "node:test";
import assert from "node:assert/strict";

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

import test from "node:test";
import assert from "node:assert/strict";

import { compareOutput, normalizeOutput } from "../src/core/output.js";

test("normalizes line endings and trailing whitespace for ACM comparison", () => {
  assert.equal(normalizeOutput("1 2  \r\n3\t\n\n"), "1 2\n3");
});

test("compares equivalent ACM output as AC", () => {
  const result = compareOutput("0 1  \r\n", "0 1\n");

  assert.deepEqual(result, {
    status: "AC",
    message: "Accepted",
  });
});

test("compares JSON array output while ignoring insignificant spaces", () => {
  const result = compareOutput("[[-1, -1, 2], [-1, 0, 1]]\n", "[[-1,-1,2],[-1,0,1]]");

  assert.deepEqual(result, {
    status: "AC",
    message: "Accepted",
  });
});

test("preserves meaningful output differences as WA", () => {
  const result = compareOutput("1 0\n", "0 1\n");

  assert.equal(result.status, "WA");
  assert.match(result.message, /Expected/);
});

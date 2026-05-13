import test from "node:test";
import assert from "node:assert/strict";

import { decodeProcessOutput } from "../src/runner/encoding.js";

test("keeps valid utf-8 process output", () => {
  const output = decodeProcessOutput([Buffer.from("错误\n", "utf8")]);

  assert.equal(output, "错误\n");
});

test("falls back to gb18030 when utf-8 decoding is broken", () => {
  const gbkBytesForChineseError = Buffer.from([0xb4, 0xed, 0xce, 0xf3]);
  const output = decodeProcessOutput([gbkBytesForChineseError]);

  assert.equal(output, "错误");
});

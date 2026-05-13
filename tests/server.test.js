import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { createAcmcoderServer } from "../src/server/server.js";

function listen(server) {
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      resolve(server.address().port);
    });
  });
}

test("serves problem metadata over the local API", async () => {
  const server = createAcmcoderServer();
  const port = await listen(server);

  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/problems`);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.problems.length, 5);
    assert.equal(body.problems[0].slug, "two-sum");
  } finally {
    server.close();
  }
});

test("serves one problem by slug", async () => {
  const server = createAcmcoderServer();
  const port = await listen(server);

  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/problems/two-sum`);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.problem.title, "两数之和");
  } finally {
    server.close();
  }
});

test("handles extension CORS preflight for memory mode", async () => {
  const server = createAcmcoderServer();
  const port = await listen(server);

  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/memory/pages`, {
      method: "OPTIONS",
      headers: {
        origin: "chrome-extension://acmcoder",
        "access-control-request-method": "POST",
      },
    });

    assert.equal(response.status, 204);
    assert.equal(response.headers.get("access-control-allow-origin"), "*");
  } finally {
    server.close();
  }
});

test("stores captured LeetCode page memory locally", async () => {
  const memoryFile = path.join(await fs.mkdtemp(path.join(os.tmpdir(), "acmcoder-memory-")), "pages.jsonl");
  const currentMemoryFile = path.join(path.dirname(memoryFile), "current.json");
  const server = createAcmcoderServer({ memoryFile, currentMemoryFile });
  const port = await listen(server);

  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/memory/pages`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        source: "leetcode",
        url: "https://leetcode.cn/problems/two-sum/",
        slug: "two-sum",
        frontendId: "1",
        title: "两数之和",
        difficulty: "easy",
        tags: ["数组", "哈希表"],
        sample: {
          inputText: "4\n2 7 11 15\n9",
          outputText: "0 1",
        },
        content: "给定一个整数数组 nums 和一个整数 target",
      }),
    });
    const body = await response.json();

    assert.equal(response.status, 201);
    assert.equal(body.page.slug, "two-sum");

    const listResponse = await fetch(`http://127.0.0.1:${port}/api/memory/pages?slug=two-sum`);
    const listBody = await listResponse.json();

    assert.equal(listBody.pages.length, 1);
    assert.equal(listBody.pages[0].title, "两数之和");

    const currentResponse = await fetch(`http://127.0.0.1:${port}/api/memory/current`);
    const currentBody = await currentResponse.json();

    assert.equal(currentBody.page.slug, "two-sum");
    assert.equal(currentBody.page.frontendId, "1");
    assert.deepEqual(currentBody.page.tags, ["数组", "哈希表"]);
    assert.equal(currentBody.page.difficulty, "easy");
    assert.equal(currentBody.page.sample.inputText, "4\n2 7 11 15\n9");
  } finally {
    server.close();
  }
});

test("exposes memory storage location for the extension sidebar", async () => {
  const memoryFile = path.join(await fs.mkdtemp(path.join(os.tmpdir(), "acmcoder-memory-")), "pages.jsonl");
  const server = createAcmcoderServer({ memoryFile });
  const port = await listen(server);

  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/memory/location`);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.file, memoryFile);
  } finally {
    server.close();
  }
});

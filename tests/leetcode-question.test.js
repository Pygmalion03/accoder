import test from "node:test";
import assert from "node:assert/strict";

import { fetchLeetCodeQuestionPage, htmlToText } from "../src/server/leetcode-question.js";

test("converts LeetCode statement HTML into readable plain text", () => {
  const text = htmlToText(`
    <p>给你一个整数数组 <code>nums</code>。</p>
    <p><strong>示例 1：</strong></p>
    <pre><strong>输入：</strong> nums = [2,7], target = 9<br><strong>输出：</strong> [0,1]</pre>
    <p>满足 2 &lt; 9 &amp;&amp; 7 &gt; 0。</p>
  `);

  assert.equal(
    text,
    "给你一个整数数组 nums。\n\n示例 1：\n\n输入： nums = [2,7], target = 9\n输出： [0,1]\n\n满足 2 < 9 && 7 > 0。",
  );
});

test("fetches and normalizes the translated LeetCode question", async () => {
  const requests = [];
  const page = await fetchLeetCodeQuestionPage(
    "two-sum",
    "https://leetcode.cn/problems/two-sum/",
    {
      now: () => new Date("2026-07-11T04:00:00.000Z"),
      fetch: async (url, options) => {
        requests.push({ url, options });
        return {
          ok: true,
          async json() {
            return {
              data: {
                question: {
                  questionFrontendId: "1",
                  title: "Two Sum",
                  translatedTitle: "两数之和",
                  difficulty: "Easy",
                  content: "<p>English statement</p>",
                  translatedContent:
                    "<p>给你一个整数数组。</p><pre>输入： nums = [2,7], target = 9<br>输出： [0,1]</pre>",
                  topicTags: [
                    { name: "Array", translatedName: "数组", slug: "array" },
                    { name: "Hash Table", translatedName: "哈希表", slug: "hash-table" },
                  ],
                },
              },
            };
          },
        };
      },
    },
  );

  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, "https://leetcode.cn/graphql/");
  assert.equal(JSON.parse(requests[0].options.body).variables.titleSlug, "two-sum");
  assert.deepEqual(page, {
    source: "leetcode",
    url: "https://leetcode.cn/problems/two-sum/",
    slug: "two-sum",
    frontendId: "1",
    title: "两数之和",
    difficulty: "easy",
    tags: ["数组", "哈希表"],
    sample: {
      inputText: "nums = [2,7], target = 9",
      outputText: "[0,1]",
    },
    content: "给你一个整数数组。\n\n输入： nums = [2,7], target = 9\n输出： [0,1]",
    capturedAt: "2026-07-11T04:00:00.000Z",
  });
});

test("rejects failed and empty LeetCode responses", async () => {
  await assert.rejects(
    fetchLeetCodeQuestionPage("two-sum", "https://leetcode.cn/problems/two-sum/", {
      fetch: async () => ({ ok: false, status: 403 }),
    }),
    /LeetCode 题面请求失败（403）/,
  );

  await assert.rejects(
    fetchLeetCodeQuestionPage("two-sum", "https://leetcode.cn/problems/two-sum/", {
      fetch: async () => ({
        ok: true,
        async json() {
          return { data: { question: null } };
        },
      }),
    }),
    /没有返回题目 two-sum/,
  );
});

import fs from "node:fs/promises";
import path from "node:path";

import { projectRoot } from "../core/problems.js";

const DEFAULT_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_MODEL = "gpt-4.1-mini";

export function getDefaultAssistSettings(env = process.env) {
  return {
    apiKey: env.ACMCODER_LLM_API_KEY || "",
    baseUrl: env.ACMCODER_LLM_BASE_URL || DEFAULT_BASE_URL,
    model: env.ACMCODER_LLM_MODEL || DEFAULT_MODEL,
  };
}

export function getDefaultAssistSettingsFile() {
  return path.join(projectRoot, "data", "memory", "settings.json");
}

function normalizeBaseUrl(value) {
  return String(value || DEFAULT_BASE_URL).trim().replace(/\/+$/, "") || DEFAULT_BASE_URL;
}

function normalizeSettings(settings, env = process.env) {
  const defaults = getDefaultAssistSettings(env);
  return {
    apiKey: String(settings.apiKey ?? defaults.apiKey ?? "").trim(),
    baseUrl: normalizeBaseUrl(settings.baseUrl ?? defaults.baseUrl),
    model: String(settings.model ?? defaults.model ?? DEFAULT_MODEL).trim() || DEFAULT_MODEL,
  };
}

export async function loadAssistSettings(settingsFile = getDefaultAssistSettingsFile(), env = process.env) {
  try {
    const saved = JSON.parse(await fs.readFile(settingsFile, "utf8"));
    return normalizeSettings({ ...getDefaultAssistSettings(env), ...saved }, env);
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
    return normalizeSettings(getDefaultAssistSettings(env), env);
  }
}

export async function saveAssistSettings(input, settingsFile = getDefaultAssistSettingsFile(), env = process.env) {
  const existing = await loadAssistSettings(settingsFile, env);
  const values = input && typeof input === "object" ? input : {};
  const next = normalizeSettings(
    {
      ...existing,
      apiKey: Object.hasOwn(values, "apiKey") ? values.apiKey : existing.apiKey,
      baseUrl: Object.hasOwn(values, "baseUrl") ? values.baseUrl : existing.baseUrl,
      model: Object.hasOwn(values, "model") ? values.model : existing.model,
    },
    env,
  );

  await fs.mkdir(path.dirname(settingsFile), { recursive: true });
  await fs.writeFile(settingsFile, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  return next;
}

export function getPublicAssistSettings(settings) {
  return {
    configured: Boolean(settings.apiKey),
    baseUrl: settings.baseUrl,
    model: settings.model,
  };
}

function truncate(value, maxLength = 20000) {
  const text = String(value || "");
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength)}\n\n[内容过长，已截断]`;
}

function buildUserPrompt(context = {}) {
  const parts = [
    `问题：${context.question || "请检查我的代码，并给出修改建议。"}`,
    `语言：${context.language || "unknown"}`,
    context.problemTitle ? `题目：${context.problemTitle}` : "",
    context.problemDescription ? `题面摘要：\n${truncate(context.problemDescription, 4000)}` : "",
    `代码：\n\`\`\`${context.language || ""}\n${truncate(context.code)}\n\`\`\``,
    context.stdin ? `自测输入：\n\`\`\`\n${truncate(context.stdin, 4000)}\n\`\`\`` : "",
    context.expected ? `预期输出：\n\`\`\`\n${truncate(context.expected, 4000)}\n\`\`\`` : "",
    context.status ? `当前结果：${context.status}` : "",
    context.stdout ? `stdout：\n\`\`\`\n${truncate(context.stdout, 4000)}\n\`\`\`` : "",
    context.stderr ? `stderr：\n\`\`\`\n${truncate(context.stderr, 4000)}\n\`\`\`` : "",
  ];

  return parts.filter(Boolean).join("\n\n");
}

async function readModelError(response) {
  try {
    const body = await response.json();
    return body.error?.message || body.message || `Model request failed: ${response.status}`;
  } catch {
    return `Model request failed: ${response.status}`;
  }
}

export async function requestCodeAdvice(options = {}) {
  const settings = normalizeSettings(options.settings || {});
  if (!settings.apiKey) {
    throw new Error("LLM API Key is not configured. Save one in model settings first.");
  }

  const fetchFn = options.fetch || globalThis.fetch;
  if (!fetchFn) {
    throw new Error("fetch is not available in this Node.js runtime.");
  }

  const response = await fetchFn(`${settings.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${settings.apiKey}`,
    },
    body: JSON.stringify({
      model: settings.model,
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content:
            "你是 ACMCoder 的编程练习助手。用户可能会闲聊、询问题目、请求代码建议或分析运行错误。不要声称已经修改源代码。",
        },
        {
          role: "user",
          content: buildUserPrompt(options.context),
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(await readModelError(response));
  }

  const body = await response.json();
  const message = body.choices?.[0]?.message?.content?.trim();
  if (!message) {
    throw new Error("Model response did not include advice text.");
  }

  return {
    message,
    model: settings.model,
  };
}

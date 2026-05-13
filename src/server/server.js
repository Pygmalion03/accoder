import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { findProblem, loadProblems, projectRoot, resolveProjectPath } from "../core/problems.js";
import { runSubmission } from "../runner/run.js";
import {
  getDefaultCurrentMemoryFile,
  getDefaultMemoryFile,
  loadCurrentMemoryPage,
  loadMemoryPages,
  saveMemoryPage,
} from "./memory.js";

const DEFAULT_PORT = 43117;

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,OPTIONS",
  "access-control-allow-headers": "content-type",
};

function sendJson(response, status, payload) {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8", ...corsHeaders });
  response.end(JSON.stringify(payload, null, 2));
}

function sendNoContent(response) {
  response.writeHead(204, corsHeaders);
  response.end();
}

async function readJsonBody(request) {
  let body = "";
  for await (const chunk of request) {
    body += chunk.toString();
  }
  return body ? JSON.parse(body) : {};
}

async function serializeProblem(problem, includeCaseText = false) {
  if (!includeCaseText) {
    return problem;
  }

  const cases = await Promise.all(
    problem.cases.map(async (testCase) => ({
      ...testCase,
      inputText: await fs.readFile(resolveProjectPath(testCase.input), "utf8"),
      outputText: await fs.readFile(resolveProjectPath(testCase.output), "utf8"),
    })),
  );

  return {
    ...problem,
    cases,
  };
}

async function readTemplate(slug, language) {
  const extensionByLanguage = {
    java: "java",
    cpp: "cpp",
    python: "py",
  };
  const extension = extensionByLanguage[language];

  if (!extension) {
    throw new Error(`Unsupported template language: ${language}`);
  }

  const fileName = language === "java" ? "Main.java" : language === "cpp" ? "main.cpp" : "main.py";
  return fs.readFile(path.join(projectRoot, "problems", slug, "templates", fileName), "utf8");
}

async function serveStatic(requestUrl, response) {
  const requestedPath = requestUrl.pathname === "/" ? "/index.html" : requestUrl.pathname;
  const webRoot = path.join(projectRoot, "web");
  const filePath = path.normalize(path.join(webRoot, requestedPath));

  if (!filePath.startsWith(webRoot)) {
    sendJson(response, 403, { error: "Forbidden" });
    return;
  }

  try {
    const content = await fs.readFile(filePath);
    const contentType = contentTypes[path.extname(filePath)] ?? "application/octet-stream";
    response.writeHead(200, { "content-type": contentType });
    response.end(content);
  } catch {
    sendJson(response, 404, { error: "Not found" });
  }
}

export function createAcmcoderServer(options = {}) {
  const memoryFile = options.memoryFile || getDefaultMemoryFile();
  const currentMemoryFile = options.currentMemoryFile || getDefaultCurrentMemoryFile();

  return http.createServer(async (request, response) => {
    const requestUrl = new URL(request.url, "http://127.0.0.1");

    try {
      if (request.method === "OPTIONS") {
        sendNoContent(response);
        return;
      }

      if (request.method === "GET" && requestUrl.pathname === "/api/problems") {
        const problems = loadProblems();
        sendJson(response, 200, { problems });
        return;
      }

      const problemMatch = requestUrl.pathname.match(/^\/api\/problems\/([^/]+)$/);
      if (request.method === "GET" && problemMatch) {
        const problem = findProblem(decodeURIComponent(problemMatch[1]));
        sendJson(response, 200, { problem: await serializeProblem(problem, true) });
        return;
      }

      const templateMatch = requestUrl.pathname.match(/^\/api\/templates\/([^/]+)\/([^/]+)$/);
      if (request.method === "GET" && templateMatch) {
        const code = await readTemplate(decodeURIComponent(templateMatch[1]), decodeURIComponent(templateMatch[2]));
        sendJson(response, 200, { code });
        return;
      }

      if (request.method === "POST" && requestUrl.pathname === "/api/run") {
        const body = await readJsonBody(request);
        const result = await runSubmission({
          language: body.language,
          code: body.code,
          stdin: body.stdin,
          expected: body.expected,
          timeoutMs: body.timeoutMs,
        });
        sendJson(response, 200, { result });
        return;
      }

      if (request.method === "GET" && requestUrl.pathname === "/api/memory/pages") {
        const pages = await loadMemoryPages({ slug: requestUrl.searchParams.get("slug") }, memoryFile);
        sendJson(response, 200, { pages });
        return;
      }

      if (request.method === "GET" && requestUrl.pathname === "/api/memory/location") {
        sendJson(response, 200, { file: memoryFile });
        return;
      }

      if (request.method === "GET" && requestUrl.pathname === "/api/memory/current") {
        const page = await loadCurrentMemoryPage(currentMemoryFile);
        sendJson(response, 200, { page });
        return;
      }

      if (request.method === "POST" && requestUrl.pathname === "/api/memory/pages") {
        const body = await readJsonBody(request);
        const page = await saveMemoryPage(body, memoryFile, currentMemoryFile);
        sendJson(response, 201, { page });
        return;
      }

      if (request.method === "GET") {
        await serveStatic(requestUrl, response);
        return;
      }

      sendJson(response, 405, { error: "Method not allowed" });
    } catch (error) {
      sendJson(response, 400, { error: error.message });
    }
  });
}

export function startServer(port = DEFAULT_PORT) {
  const server = createAcmcoderServer();
  server.listen(port, "127.0.0.1", () => {
    console.log(`ACMCoder is running at http://127.0.0.1:${port}`);
  });
  return server;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  startServer(Number(process.env.PORT || DEFAULT_PORT));
}

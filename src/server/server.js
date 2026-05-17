import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { findProblem, loadProblems, projectRoot, resolveProjectPath } from "../core/problems.js";
import {
  deleteProblems,
  exportProblems,
  filterVisibleProblems,
  getDefaultDeletedProblemsFile,
  importProblems,
  loadDeletedProblemSlugs,
} from "./problem-actions.js";
import { runSubmission as defaultRunSubmission } from "../runner/run.js";
import {
  getDefaultCurrentMemoryFile,
  getDefaultMemoryFile,
  deleteMemoryPages,
  exportMemoryPages,
  loadCurrentMemoryPage,
  loadMemoryPages,
  saveMemoryPage,
} from "./memory.js";
import {
  getDefaultProgressFile,
  loadProgressItems,
  progressForSlug,
  recordAcceptedProgress,
  withPageProgress,
  withProblemProgress,
} from "./progress.js";

const DEFAULT_PORT = 43117;

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,DELETE,OPTIONS",
  "access-control-allow-headers": "content-type",
};

function sendJson(response, status, payload) {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8", ...corsHeaders });
  response.end(JSON.stringify(payload, null, 2));
}

function sendJsonDownload(response, filename, payload) {
  response.writeHead(200, {
    "content-type": "application/json; charset=utf-8",
    "content-disposition": `attachment; filename="${filename}"`,
    ...corsHeaders,
  });
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

async function serializeProblemsWithProgress(problems, progressFile) {
  const progressItems = await loadProgressItems(progressFile);
  return problems.map((problem) => withProblemProgress(problem, progressItems));
}

async function serializePagesWithProgress(pages, progressFile) {
  const progressItems = await loadProgressItems(progressFile);
  return pages.map((page) => withPageProgress(page, progressItems));
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
  const deletedProblemsFile = options.deletedProblemsFile || getDefaultDeletedProblemsFile();
  const progressFile = options.progressFile || getDefaultProgressFile();
  const runSubmission = options.runSubmission || defaultRunSubmission;

  return http.createServer(async (request, response) => {
    const requestUrl = new URL(request.url, "http://127.0.0.1");

    try {
      if (request.method === "OPTIONS") {
        sendNoContent(response);
        return;
      }

      if (request.method === "GET" && requestUrl.pathname === "/api/problems") {
        const deletedSlugs = await loadDeletedProblemSlugs(deletedProblemsFile);
        const problems = await serializeProblemsWithProgress(filterVisibleProblems(loadProblems(), deletedSlugs), progressFile);
        sendJson(response, 200, { problems });
        return;
      }

      if (request.method === "DELETE" && requestUrl.pathname === "/api/problems") {
        const body = await readJsonBody(request);
        const result = await deleteProblems({
          slugs: body.slugs || [],
          problems: loadProblems(),
          memoryFile,
          currentMemoryFile,
          deletedProblemsFile,
          progressFile,
        });
        sendJson(response, 200, result);
        return;
      }

      if (request.method === "POST" && requestUrl.pathname === "/api/problems/import") {
        const body = await readJsonBody(request);
        const result = await importProblems({
          payload: body,
          problems: loadProblems(),
          memoryFile,
          currentMemoryFile,
          deletedProblemsFile,
          progressFile,
        });
        sendJson(response, 200, result);
        return;
      }

      if (request.method === "GET" && requestUrl.pathname === "/api/problems/export") {
        const slugs = (requestUrl.searchParams.get("slugs") || "").split(",");
        const body = await exportProblems({
          slugs,
          problems: loadProblems(),
          memoryFile,
          deletedProblemsFile,
          progressFile,
        });
        sendJsonDownload(response, `acmcoder-problems-${new Date().toISOString().slice(0, 10)}.json`, body);
        return;
      }

      const problemMatch = requestUrl.pathname.match(/^\/api\/problems\/([^/]+)$/);
      if (request.method === "GET" && problemMatch) {
        const slug = decodeURIComponent(problemMatch[1]);
        const deletedSlugs = await loadDeletedProblemSlugs(deletedProblemsFile);
        if (deletedSlugs.has(slug)) {
          throw new Error(`Unknown problem: ${slug}`);
        }
        const problem = await serializeProblem(findProblem(slug), true);
        const progressItems = await loadProgressItems(progressFile);
        sendJson(response, 200, { problem: withProblemProgress(problem, progressItems) });
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
          runner: body.runner,
        });
        const progress =
          result.status === "AC"
            ? await recordAcceptedProgress(body.slug, progressFile)
            : progressForSlug(body.slug, await loadProgressItems(progressFile));
        sendJson(response, 200, { result, progress });
        return;
      }

      if (request.method === "GET" && requestUrl.pathname === "/api/memory/pages") {
        const pages = await loadMemoryPages({ slug: requestUrl.searchParams.get("slug") }, memoryFile);
        sendJson(response, 200, { pages: await serializePagesWithProgress(pages, progressFile) });
        return;
      }

      if (request.method === "DELETE" && requestUrl.pathname === "/api/memory/pages") {
        const body = await readJsonBody(request);
        const result = await deleteMemoryPages({ slugs: body.slugs || [] }, memoryFile, currentMemoryFile);
        sendJson(response, 200, result);
        return;
      }

      if (request.method === "GET" && requestUrl.pathname === "/api/memory/export") {
        const slugs = (requestUrl.searchParams.get("slugs") || "").split(",");
        const body = await exportMemoryPages({ slugs }, memoryFile);
        body.pages = await serializePagesWithProgress(body.pages, progressFile);
        sendJsonDownload(response, `acmcoder-memory-${new Date().toISOString().slice(0, 10)}.json`, body);
        return;
      }

      if (request.method === "GET" && requestUrl.pathname === "/api/memory/location") {
        sendJson(response, 200, { file: memoryFile });
        return;
      }

      if (request.method === "GET" && requestUrl.pathname === "/api/memory/current") {
        const page = await loadCurrentMemoryPage(currentMemoryFile);
        const pages = page ? await serializePagesWithProgress([page], progressFile) : [];
        sendJson(response, 200, { page: pages[0] || null });
        return;
      }

      if (request.method === "POST" && requestUrl.pathname === "/api/memory/pages") {
        const body = await readJsonBody(request);
        const page = await saveMemoryPage(body, memoryFile, currentMemoryFile);
        const pages = await serializePagesWithProgress([page], progressFile);
        sendJson(response, 201, { page: pages[0] });
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

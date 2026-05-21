import test from "node:test";
import assert from "node:assert/strict";

import { createEnvironmentReport } from "../src/server/doctor.js";
import { createAcmcoderServer } from "../src/server/server.js";

function listen(server) {
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      resolve(server.address().port);
    });
  });
}

function toolchain(language, ready, missingCommands = []) {
  const labels = {
    python: "Python 3",
    java: "Java",
    cpp: "C++17",
  };
  const commandsByLanguage = {
    python: ["python"],
    java: ["javac", "java"],
    cpp: ["g++"],
  };

  return {
    language,
    label: labels[language],
    ready,
    checks: commandsByLanguage[language].map((command) => ({
      command,
      available: !missingCommands.includes(command),
    })),
  };
}

test("builds environment report with per-language runner recommendations", async () => {
  const report = await createEnvironmentReport({
    listLanguages: () => ["python", "java", "cpp"],
    checkToolchain: async (language) => {
      if (language === "java") return toolchain(language, false, ["javac"]);
      return toolchain(language, true);
    },
    checkDockerRunner: async () => ({
      ready: true,
      image: "acmcoder-runner:local",
      message: "Docker daemon ready; image will be built automatically.",
    }),
  });

  assert.equal(report.local.python.ready, true);
  assert.equal(report.local.java.ready, false);
  assert.deepEqual(report.local.java.missingCommands, ["javac"]);
  assert.equal(report.docker.ready, true);
  assert.deepEqual(report.recommendedRunnerByLanguage, {
    python: "local",
    java: "docker",
    cpp: "local",
  });
});

test("serves environment doctor over the local API", async () => {
  const server = createAcmcoderServer({
    listLanguages: () => ["python", "java"],
    checkToolchain: async (language) => {
      if (language === "java") return toolchain(language, false, ["javac", "java"]);
      return toolchain(language, true);
    },
    checkDockerRunner: async () => ({
      ready: false,
      image: "custom/acmcoder-runner:test",
      message: "Docker daemon is not running.",
    }),
  });
  const port = await listen(server);

  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/doctor`);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.local.python.ready, true);
    assert.deepEqual(body.local.java.missingCommands, ["javac", "java"]);
    assert.equal(body.docker.image, "custom/acmcoder-runner:test");
    assert.equal(body.recommendedRunnerByLanguage.java, "local");
  } finally {
    server.close();
  }
});

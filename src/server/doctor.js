import { checkToolchain as defaultCheckToolchain, listLanguages as defaultListLanguages } from "../runner/toolchains.js";
import { checkDockerRunner as defaultCheckDockerRunner } from "../runner/docker-runner.js";

function addMissingCommands(result) {
  const checks = Array.isArray(result.checks) ? result.checks : [];
  return {
    ...result,
    checks,
    missingCommands: checks.filter((item) => !item.available).map((item) => item.command),
  };
}

async function safeCheckToolchain(language, checkToolchain) {
  try {
    return addMissingCommands(await checkToolchain(language));
  } catch (error) {
    return {
      language,
      label: language,
      ready: false,
      checks: [],
      missingCommands: [],
      message: error.message,
    };
  }
}

export async function createEnvironmentReport(options = {}) {
  const listLanguages = options.listLanguages || defaultListLanguages;
  const checkToolchain = options.checkToolchain || defaultCheckToolchain;
  const checkDockerRunner = options.checkDockerRunner || defaultCheckDockerRunner;
  const languages = listLanguages();

  const [toolchains, docker] = await Promise.all([
    Promise.all(languages.map((language) => safeCheckToolchain(language, checkToolchain))),
    checkDockerRunner(),
  ]);

  const local = Object.fromEntries(toolchains.map((toolchain) => [toolchain.language, toolchain]));
  const recommendedRunnerByLanguage = Object.fromEntries(
    toolchains.map((toolchain) => [toolchain.language, toolchain.ready ? "local" : docker.ready ? "docker" : "local"]),
  );

  return {
    local,
    docker,
    recommendedRunnerByLanguage,
  };
}

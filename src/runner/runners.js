import { localRunner } from "./local-runner.js";

const dockerRunnerPlaceholder = {
  name: "docker",

  resolveSourceFile({ toolchain }) {
    return `/workspace/${toolchain.entryFile}`;
  },

  resolveWorkdir() {
    return "/workspace";
  },

  async execute() {
    return {
      status: "NO_RUNNER",
      runnerUnavailable: true,
      message: "Docker runner is not implemented yet.",
      stdout: "",
      stderr: "",
    };
  },
};

export const DEFAULT_RUNNER = "local";

const runners = {
  local: localRunner,
  docker: dockerRunnerPlaceholder,
};

export function normalizeRunner(value) {
  const runner = String(value || DEFAULT_RUNNER).toLowerCase();

  if (!runners[runner]) {
    throw new Error(`Unsupported runner: ${value}. Supported runners: ${Object.keys(runners).join(", ")}`);
  }

  return runner;
}

export function getRunner(value) {
  return runners[normalizeRunner(value)];
}

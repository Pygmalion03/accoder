import { dockerRunner } from "./docker-runner.js";
import { localRunner } from "./local-runner.js";

export const DEFAULT_RUNNER = "local";

const runners = {
  local: localRunner,
  docker: dockerRunner,
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

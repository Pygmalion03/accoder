import { runProcess } from "./process.js";

export const DOCKER_IMAGE = "acmcoder-runner:local";
export const DOCKER_WORKDIR = "/workspace";

export function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'\"'\"'`)}'`;
}

function normalizeContainerPath(value) {
  return String(value).replace(/\\/g, "/");
}

export function buildShellCommand(commandSpec) {
  return [commandSpec.command, ...commandSpec.args].map(normalizeContainerPath).map(shellQuote).join(" ");
}

export function buildDockerArgs({ hostWorkdir, commandSpec, image = DOCKER_IMAGE }) {
  return [
    "run",
    "--rm",
    "-i",
    "--network",
    "none",
    "--cpus",
    "1",
    "--memory",
    "256m",
    "--pids-limit",
    "128",
    "-v",
    `${hostWorkdir}:${DOCKER_WORKDIR}`,
    "-w",
    DOCKER_WORKDIR,
    image,
    "bash",
    "-lc",
    buildShellCommand(commandSpec),
  ];
}

export function classifyDockerUnavailable(result) {
  if (result.failedToStart) {
    return {
      status: "NO_RUNNER",
      message: "Docker CLI is not available. Install Docker Desktop and make sure the docker command is on PATH.",
    };
  }

  const stderr = result.stderr || "";

  if (/Cannot connect to the Docker daemon|docker daemon is not running|error during connect|failed to connect to the docker API/i.test(stderr)) {
    return {
      status: "NO_RUNNER",
      message: "Docker daemon is not running. Start Docker Desktop and try again.",
    };
  }

  if (/Unable to find image|pull access denied|repository does not exist/i.test(stderr)) {
    return {
      status: "NO_RUNNER",
      message: "Docker runner image is missing. Run: docker build -t acmcoder-runner:local .",
    };
  }

  if (result.code === 125) {
    return {
      status: "NO_RUNNER",
      message: "Docker runner failed to start. Check Docker Desktop and the acmcoder-runner:local image.",
    };
  }

  return null;
}

export const dockerRunner = {
  name: "docker",

  resolveSourceFile({ toolchain }) {
    return `${DOCKER_WORKDIR}/${toolchain.entryFile}`;
  },

  resolveWorkdir() {
    return DOCKER_WORKDIR;
  },

  async execute(commandSpec, options = {}) {
    const dockerArgs = buildDockerArgs({
      hostWorkdir: options.hostWorkdir,
      commandSpec,
    });
    const result = await runProcess("docker", dockerArgs, {
      stdin: options.stdin,
      timeoutMs: options.timeoutMs,
    });
    const unavailable = classifyDockerUnavailable(result);

    return unavailable ? { ...result, ...unavailable, runnerUnavailable: true } : result;
  },
};

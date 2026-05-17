import { runProcess } from "./process.js";

export const DOCKER_IMAGE = "acmcoder-runner:local";
export const DOCKER_WORKDIR = "/workspace";

export function getDockerImage(env = process.env) {
  const image = env?.ACMCODER_DOCKER_IMAGE?.trim();
  return image || DOCKER_IMAGE;
}

export function dockerBuildCommand(image = getDockerImage()) {
  return `docker build -t ${image} .`;
}

export function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'\"'\"'`)}'`;
}

function normalizeContainerPath(value) {
  return String(value).replace(/\\/g, "/");
}

export function buildShellCommand(commandSpec) {
  return [commandSpec.command, ...commandSpec.args].map(normalizeContainerPath).map(shellQuote).join(" ");
}

export function buildDockerArgs({ hostWorkdir, commandSpec, image = getDockerImage() }) {
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

export function classifyDockerUnavailable(result, image = getDockerImage()) {
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

  if (/Unable to find image|No such image|pull access denied|repository does not exist/i.test(stderr)) {
    return {
      status: "NO_RUNNER",
      message: `Docker runner image is missing. Run: ${dockerBuildCommand(image)}`,
    };
  }

  if (result.code === 125) {
    return {
      status: "NO_RUNNER",
      message: `Docker runner failed to start. Check Docker Desktop and the ${image} image.`,
    };
  }

  return null;
}

export function interpretDockerDoctorResult({ image = getDockerImage(), dockerResult, imageResult }) {
  const dockerUnavailable = classifyDockerUnavailable(dockerResult, image);
  if (dockerUnavailable) {
    return {
      ready: false,
      image,
      message: dockerUnavailable.message,
    };
  }

  if (dockerResult.code !== 0) {
    return {
      ready: false,
      image,
      message: dockerResult.stderr || "Docker runner is unavailable.",
    };
  }

  const imageUnavailable = classifyDockerUnavailable(
    imageResult || {
      code: 1,
      stderr: `No such image: ${image}`,
    },
    image,
  );

  if (imageUnavailable || imageResult.code !== 0) {
    return {
      ready: false,
      image,
      message: imageUnavailable?.message || `Docker runner image is missing. Run: ${dockerBuildCommand(image)}`,
    };
  }

  return {
    ready: true,
    image,
    message: `Docker daemon ready; image ${image} is available.`,
  };
}

export async function checkDockerRunner(options = {}) {
  const image = options.image || getDockerImage(options.env);
  const timeoutMs = options.timeoutMs ?? 5000;
  const dockerResult = await runProcess("docker", ["version", "--format", "{{.Server.Version}}"], { timeoutMs });

  if (dockerResult.failedToStart || dockerResult.code !== 0) {
    return interpretDockerDoctorResult({ image, dockerResult, imageResult: null });
  }

  const imageResult = await runProcess("docker", ["image", "inspect", image], { timeoutMs });
  return interpretDockerDoctorResult({ image, dockerResult, imageResult });
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
    const image = options.image || getDockerImage(options.env);
    const dockerArgs = buildDockerArgs({
      hostWorkdir: options.hostWorkdir,
      commandSpec,
      image,
    });
    const result = await runProcess("docker", dockerArgs, {
      stdin: options.stdin,
      timeoutMs: options.timeoutMs,
    });
    const unavailable = classifyDockerUnavailable(result, image);

    return unavailable ? { ...result, ...unavailable, runnerUnavailable: true } : result;
  },
};

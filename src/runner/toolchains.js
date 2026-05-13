import { spawn } from "node:child_process";
import path from "node:path";

const executableExtension = process.platform === "win32" ? ".exe" : "";

const toolchains = {
  java: {
    language: "java",
    label: "Java",
    extension: ".java",
    entryFile: "Main.java",
    commands: ["javac", "java"],
    compile: ({ sourceFile }) => ({
      command: "javac",
      args: ["-encoding", "UTF-8", sourceFile],
    }),
    run: ({ workdir }) => ({
      command: "java",
      args: ["-cp", workdir, "Main"],
    }),
  },
  cpp: {
    language: "cpp",
    label: "C++17",
    extension: ".cpp",
    entryFile: "main.cpp",
    commands: ["g++"],
    compile: ({ sourceFile, workdir }) => ({
      command: "g++",
      args: [sourceFile, "-std=c++17", "-O2", "-pipe", "-o", path.join(workdir, `main${executableExtension}`)],
    }),
    run: ({ workdir }) => ({
      command: path.join(workdir, `main${executableExtension}`),
      args: [],
    }),
  },
  python: {
    language: "python",
    label: "Python 3",
    extension: ".py",
    entryFile: "main.py",
    commands: ["python"],
    compile: null,
    run: ({ sourceFile }) => ({
      command: "python",
      args: [sourceFile],
    }),
  },
};

export function listLanguages() {
  return Object.keys(toolchains);
}

export function getToolchain(language) {
  const key = String(language ?? "").toLowerCase();
  const toolchain = toolchains[key];

  if (!toolchain) {
    throw new Error(`Unsupported language: ${language}. Supported languages: ${listLanguages().join(", ")}`);
  }

  return toolchain;
}

export async function checkCommand(command) {
  return new Promise((resolve) => {
    const child = spawn(command, ["--version"], { windowsHide: true });

    child.once("error", () => resolve(false));
    child.once("exit", (code) => resolve(code === 0 || code === 1));
  });
}

export async function checkToolchain(language) {
  const toolchain = getToolchain(language);
  const checks = await Promise.all(
    toolchain.commands.map(async (command) => ({
      command,
      available: await checkCommand(command),
    })),
  );

  return {
    language: toolchain.language,
    label: toolchain.label,
    ready: checks.every((item) => item.available),
    checks,
  };
}

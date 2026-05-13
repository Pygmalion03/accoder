export function parseCliArgs(argv) {
  const args = [...argv];
  const command = args.shift() ?? "help";
  const positional = [];
  const options = {};

  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];

    if (token.startsWith("--")) {
      const key = token.slice(2);
      const value = args[index + 1];

      if (!value || value.startsWith("--")) {
        throw new Error(`Missing value for --${key}`);
      }

      options[key] = value;
      index += 1;
    } else {
      positional.push(token);
    }
  }

  return {
    command,
    positional,
    options,
  };
}

export function requireOption(options, key) {
  const value = options[key];
  if (!value) {
    throw new Error(`Missing required option: --${key}`);
  }
  return value;
}

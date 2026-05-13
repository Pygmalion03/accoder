export function normalizeOutput(value) {
  const lines = String(value ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/g, ""));

  while (lines.length > 0 && lines[lines.length - 1] === "") {
    lines.pop();
  }

  return lines.join("\n");
}

export function compareOutput(actual, expected) {
  const normalizedActual = normalizeOutput(actual);
  const normalizedExpected = normalizeOutput(expected);

  if (normalizedActual === normalizedExpected) {
    return {
      status: "AC",
      message: "Accepted",
    };
  }

  return {
    status: "WA",
    message: `Expected:\n${normalizedExpected}\n\nActual:\n${normalizedActual}`,
  };
}

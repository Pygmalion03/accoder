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

function tryParseJsonOutput(value) {
  try {
    return {
      parsed: true,
      value: JSON.parse(value),
    };
  } catch {
    return {
      parsed: false,
      value: null,
    };
  }
}

function jsonValuesEqual(left, right) {
  if (Object.is(left, right)) {
    return true;
  }

  if (Array.isArray(left) || Array.isArray(right)) {
    return (
      Array.isArray(left) &&
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((value, index) => jsonValuesEqual(value, right[index]))
    );
  }

  if (left && right && typeof left === "object" && typeof right === "object") {
    const leftKeys = Object.keys(left).sort();
    const rightKeys = Object.keys(right).sort();
    return (
      leftKeys.length === rightKeys.length &&
      leftKeys.every((key, index) => key === rightKeys[index] && jsonValuesEqual(left[key], right[key]))
    );
  }

  return false;
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

  const actualJson = tryParseJsonOutput(normalizedActual);
  const expectedJson = tryParseJsonOutput(normalizedExpected);
  if (actualJson.parsed && expectedJson.parsed && jsonValuesEqual(actualJson.value, expectedJson.value)) {
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

const utf8Decoder = new TextDecoder("utf-8", { fatal: false });
const gb18030Decoder = new TextDecoder("gb18030", { fatal: false });

export function decodeProcessOutput(chunks) {
  const buffer = Buffer.concat(chunks);
  if (buffer.length === 0) {
    return "";
  }

  const utf8Text = utf8Decoder.decode(buffer);
  if (!utf8Text.includes("\uFFFD")) {
    return utf8Text;
  }

  return gb18030Decoder.decode(buffer);
}

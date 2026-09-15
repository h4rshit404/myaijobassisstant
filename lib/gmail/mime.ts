function encodeHeader(value: string): string {
  return `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
}

function base64Wrapped(value: string): string {
  const b64 = Buffer.from(value, "utf8").toString("base64");
  return b64.replace(/.{76}/g, "$&\r\n");
}

/** Builds a base64url-encoded RFC 2822 message for the Gmail API. Body is sent as HTML —
 * the body-transfer-encoding is base64 (not 7bit) so non-ASCII content (accents, curly
 * quotes the model likes to use) survives correctly. */
export function buildRawMessage(params: {
  from: string;
  to: string;
  subject: string;
  html: string;
}): string {
  const { from, to, subject, html } = params;

  const message = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${encodeHeader(subject)}`,
    "MIME-Version: 1.0",
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    base64Wrapped(html),
  ].join("\r\n");

  return Buffer.from(message)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

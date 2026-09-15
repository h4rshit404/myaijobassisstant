import { google } from "googleapis";
import { prisma } from "@/lib/prisma";
import { decryptSecretOrNull } from "@/lib/crypto";
import { buildRawMessage } from "@/lib/gmail/mime";

export class GmailNotConnectedError extends Error {
  constructor() {
    super("Gmail isn't connected. Reconnect it from Settings.");
    this.name = "GmailNotConnectedError";
  }
}

async function getOAuthClientForUser(userId: string) {
  const gmailAccount = await prisma.gmailAccount.findUnique({ where: { userId } });
  const refreshToken = decryptSecretOrNull(
    gmailAccount?.refreshTokenEncrypted,
    gmailAccount?.refreshTokenIv,
    gmailAccount?.refreshTokenAuthTag
  );
  if (!gmailAccount || !refreshToken) throw new GmailNotConnectedError();

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
  oauth2Client.setCredentials({ refresh_token: refreshToken });

  return { oauth2Client, email: gmailAccount.email };
}

/** Sends a plain-text email from the user's own Gmail account via their OAuth grant.
 * Returns the Gmail message id. Throws GmailNotConnectedError if the grant is missing;
 * callers (the batch send endpoint) are expected to catch per-item and keep going. */
export async function sendGmailMessage(params: {
  userId: string;
  to: string;
  subject: string;
  body: string;
}): Promise<string> {
  const { userId, to, subject, body } = params;
  const { oauth2Client, email } = await getOAuthClientForUser(userId);

  const gmail = google.gmail({ version: "v1", auth: oauth2Client });
  const raw = buildRawMessage({ from: email, to, subject, body });

  const res = await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw },
  });

  if (!res.data.id) throw new Error("Gmail did not return a message id");
  return res.data.id;
}

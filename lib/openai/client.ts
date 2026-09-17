import OpenAI from "openai";
import { prisma } from "@/lib/prisma";
import { decryptSecretOrNull } from "@/lib/crypto";

export interface UserOpenAI {
  client: OpenAI;
  model: string;
}

/** Returns null if the user hasn't configured (or validated) an OpenAI key. */
export async function getOpenAIForUser(userId: string): Promise<UserOpenAI | null> {
  const keySet = await prisma.apiKeySet.findUnique({ where: { userId } });
  if (!keySet) return null;

  const apiKey = decryptSecretOrNull(
    keySet.openaiKeyEncrypted,
    keySet.openaiKeyIv,
    keySet.openaiKeyAuthTag
  );
  if (!apiKey) return null;

  return { client: new OpenAI({ apiKey }), model: keySet.openaiModel };
}

/** Makes a minimal, cheap call to confirm a raw API key is valid before we persist it. */
export async function validateOpenAIKey(apiKey: string): Promise<boolean> {
  try {
    const client = new OpenAI({ apiKey });
    await client.models.list();
    return true;
  } catch (error) {
    console.error("[openai] key validation failed:", error);
    return false;
  }
}

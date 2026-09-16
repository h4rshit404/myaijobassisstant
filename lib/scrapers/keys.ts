import { prisma } from "@/lib/prisma";
import { decryptSecretOrNull } from "@/lib/crypto";
import type { DecryptedScraperKeys } from "@/lib/scrapers/types";

/** User-configured keys take priority; app-level env vars are the fallback. */
export async function getScraperKeysForUser(userId: string): Promise<DecryptedScraperKeys> {
  const keySet = await prisma.apiKeySet.findUnique({ where: { userId } });

  return {
    adzunaAppId:
      decryptSecretOrNull(keySet?.adzunaAppIdEncrypted, keySet?.adzunaAppIdIv, keySet?.adzunaAppIdAuthTag) ??
      process.env.ADZUNA_APP_ID ??
      undefined,
    adzunaAppKey:
      decryptSecretOrNull(
        keySet?.adzunaAppKeyEncrypted,
        keySet?.adzunaAppKeyIv,
        keySet?.adzunaAppKeyAuthTag
      ) ??
      process.env.ADZUNA_APP_KEY ??
      undefined,
    rapidApiKey:
      decryptSecretOrNull(keySet?.rapidApiKeyEncrypted, keySet?.rapidApiKeyIv, keySet?.rapidApiKeyAuthTag) ??
      process.env.RAPIDAPI_KEY ??
      undefined,
    serpApiKey:
      decryptSecretOrNull(keySet?.serpApiKeyEncrypted, keySet?.serpApiKeyIv, keySet?.serpApiKeyAuthTag) ??
      process.env.SERPAPI_KEY ??
      undefined,
    joobleApiKey:
      decryptSecretOrNull(keySet?.joobleApiKeyEncrypted, keySet?.joobleApiKeyIv, keySet?.joobleApiKeyAuthTag) ??
      process.env.JOOBLE_API_KEY ??
      undefined,
    hunterApiKey:
      decryptSecretOrNull(keySet?.hunterApiKeyEncrypted, keySet?.hunterApiKeyIv, keySet?.hunterApiKeyAuthTag) ??
      process.env.HUNTER_API_KEY ??
      undefined,
  };
}

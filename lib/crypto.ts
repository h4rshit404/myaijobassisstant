import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";

function getKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) {
    throw new Error("ENCRYPTION_KEY environment variable is not set");
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error("ENCRYPTION_KEY must decode to exactly 32 bytes (base64-encoded)");
  }
  return key;
}

export interface EncryptedField {
  ciphertext: string;
  iv: string;
  authTag: string;
}

export function encryptSecret(plaintext: string): EncryptedField {
  const key = getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    authTag: authTag.toString("base64"),
  };
}

export function decryptSecret(field: EncryptedField): string {
  const key = getKey();
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(field.iv, "base64"));
  decipher.setAuthTag(Buffer.from(field.authTag, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(field.ciphertext, "base64")),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}

/** Returns null if any part of the encrypted field is missing (i.e. never set). */
export function decryptSecretOrNull(
  ciphertext?: string | null,
  iv?: string | null,
  authTag?: string | null
): string | null {
  if (!ciphertext || !iv || !authTag) return null;
  try {
    return decryptSecret({ ciphertext, iv, authTag });
  } catch (error) {
    console.error("[crypto] failed to decrypt stored secret:", error);
    return null;
  }
}

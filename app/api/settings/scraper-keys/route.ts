import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { encryptSecret, type EncryptedField } from "@/lib/crypto";

const BodySchema = z.object({
  adzunaAppId: z.string().optional(),
  adzunaAppKey: z.string().optional(),
  rapidApiKey: z.string().optional(),
  serpApiKey: z.string().optional(),
});

function fieldUpdate(prefix: string, value: string | undefined) {
  if (value === undefined) return {};
  if (value === "") {
    return {
      [`${prefix}Encrypted`]: null,
      [`${prefix}Iv`]: null,
      [`${prefix}AuthTag`]: null,
    };
  }
  const enc: EncryptedField = encryptSecret(value);
  return {
    [`${prefix}Encrypted`]: enc.ciphertext,
    [`${prefix}Iv`]: enc.iv,
    [`${prefix}AuthTag`]: enc.authTag,
  };
}

export async function POST(req: Request) {
  const user = await requireUser();
  const parsed = BodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const { adzunaAppId, adzunaAppKey, rapidApiKey, serpApiKey } = parsed.data;

  const updates = {
    ...fieldUpdate("adzunaAppId", adzunaAppId),
    ...fieldUpdate("adzunaAppKey", adzunaAppKey),
    ...fieldUpdate("rapidApiKey", rapidApiKey),
    ...fieldUpdate("serpApiKey", serpApiKey),
  };

  await prisma.apiKeySet.upsert({
    where: { userId: user.id },
    update: updates,
    create: { userId: user.id, ...updates },
  });

  return NextResponse.json({ ok: true });
}

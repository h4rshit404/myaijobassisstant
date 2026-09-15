import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { encryptSecret } from "@/lib/crypto";
import { validateOpenAIKey } from "@/lib/openai/client";

const BodySchema = z.object({
  apiKey: z.string().min(20, "That doesn't look like a valid OpenAI API key"),
  model: z.enum(["gpt-4o-mini", "gpt-4o", "gpt-3.5-turbo"]).default("gpt-4o-mini"),
});

export async function POST(req: Request) {
  const user = await requireUser();
  const parsed = BodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  }
  const { apiKey, model } = parsed.data;

  const isValid = await validateOpenAIKey(apiKey);
  if (!isValid) {
    return NextResponse.json(
      { error: "OpenAI rejected this key. Double check it and try again." },
      { status: 400 }
    );
  }

  const encrypted = encryptSecret(apiKey);
  await prisma.apiKeySet.upsert({
    where: { userId: user.id },
    update: {
      openaiKeyEncrypted: encrypted.ciphertext,
      openaiKeyIv: encrypted.iv,
      openaiKeyAuthTag: encrypted.authTag,
      openaiModel: model,
      openaiIsValid: true,
      openaiLastValidated: new Date(),
    },
    create: {
      userId: user.id,
      openaiKeyEncrypted: encrypted.ciphertext,
      openaiKeyIv: encrypted.iv,
      openaiKeyAuthTag: encrypted.authTag,
      openaiModel: model,
      openaiIsValid: true,
      openaiLastValidated: new Date(),
    },
  });

  return NextResponse.json({ ok: true });
}

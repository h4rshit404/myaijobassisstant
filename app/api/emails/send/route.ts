import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { sendGmailMessage } from "@/lib/gmail/client";
import { sleep } from "@/lib/scrapers/http";

const BodySchema = z.object({
  drafts: z
    .array(
      z.object({
        id: z.string(),
        subject: z.string().min(1).max(200),
        body: z.string().min(1).max(6000),
      })
    )
    .min(1)
    .max(50),
});

const DELAY_BETWEEN_SENDS_MS = 800;

export async function POST(req: Request) {
  const user = await requireUser();
  const parsed = BodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const results: { id: string; status: "SENT" | "FAILED"; error?: string }[] = [];

  for (const draft of parsed.data.drafts) {
    const outboundEmail = await prisma.outboundEmail.findFirst({
      where: { id: draft.id, userId: user.id },
      include: { jobListing: true },
    });

    if (!outboundEmail) {
      results.push({ id: draft.id, status: "FAILED", error: "Draft not found" });
      continue;
    }
    if (!outboundEmail.jobListing.contactEmail) {
      results.push({ id: draft.id, status: "FAILED", error: "No contact email on this listing" });
      continue;
    }

    try {
      const gmailMessageId = await sendGmailMessage({
        userId: user.id,
        to: outboundEmail.jobListing.contactEmail,
        subject: draft.subject,
        body: draft.body,
      });

      await prisma.outboundEmail.update({
        where: { id: outboundEmail.id },
        data: {
          subject: draft.subject,
          body: draft.body,
          status: "SENT",
          gmailMessageId,
          sentAt: new Date(),
          error: null,
        },
      });
      results.push({ id: draft.id, status: "SENT" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to send";
      await prisma.outboundEmail.update({
        where: { id: outboundEmail.id },
        data: { subject: draft.subject, body: draft.body, status: "FAILED", error: message },
      });
      results.push({ id: draft.id, status: "FAILED", error: message });
    }

    await sleep(DELAY_BETWEEN_SENDS_MS);
  }

  return NextResponse.json({ results });
}

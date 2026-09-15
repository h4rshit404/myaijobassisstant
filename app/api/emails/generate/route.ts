import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { getOpenAIForUser } from "@/lib/openai/client";
import { generateOutreachEmail } from "@/lib/openai/generate-email";

const BodySchema = z.object({
  jobListingIds: z.array(z.string()).min(1).max(50),
});

export async function POST(req: Request) {
  const user = await requireUser();
  const parsed = BodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const profile = await prisma.profile.findUnique({ where: { userId: user.id } });
  if (!profile) {
    return NextResponse.json({ error: "Complete your profile first" }, { status: 400 });
  }
  if (!profile.resumeDriveLink) {
    return NextResponse.json(
      { error: "Add a resume Drive link in your profile before sending outreach emails" },
      { status: 400 }
    );
  }

  const listings = await prisma.jobListing.findMany({
    where: {
      id: { in: parsed.data.jobListingIds },
      jobSearch: { userId: user.id },
    },
  });

  const openai = await getOpenAIForUser(user.id);
  const outreachPreferences = (profile.outreachPreferences as { tone?: string; notes?: string } | null) ?? {};

  const drafts = [];
  const skipped: { jobListingId: string; reason: string }[] = [];

  for (const listing of listings) {
    if (listing.emailType === "UNKNOWN" || !listing.contactEmail) {
      skipped.push({ jobListingId: listing.id, reason: "No classified contact email for this listing" });
      continue;
    }

    const type = listing.emailType === "HR" ? "APPLICATION" : "REFERRAL";
    const generated = await generateOutreachEmail(openai, {
      type,
      jobTitle: listing.title,
      company: listing.company,
      location: listing.location,
      candidateName: user.name ?? "Candidate",
      headline: profile.headline ?? undefined,
      skills: profile.skills,
      resumeLink: profile.resumeDriveLink,
      tone: outreachPreferences.tone ?? "friendly",
      notes: outreachPreferences.notes ?? undefined,
    });

    const outboundEmail = await prisma.outboundEmail.create({
      data: {
        userId: user.id,
        jobListingId: listing.id,
        type,
        subject: generated.subject,
        body: generated.body,
        status: "DRAFT",
      },
    });

    drafts.push({
      id: outboundEmail.id,
      jobListingId: listing.id,
      jobTitle: listing.title,
      company: listing.company,
      contactEmail: listing.contactEmail,
      type,
      subject: outboundEmail.subject,
      body: outboundEmail.body,
    });
  }

  return NextResponse.json({ drafts, skipped });
}

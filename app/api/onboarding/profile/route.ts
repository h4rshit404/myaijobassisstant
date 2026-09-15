import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";

const ProfileInputSchema = z.object({
  resumeFileUrl: z.string().optional().nullable(),
  resumeFileName: z.string().optional().nullable(),
  resumeDriveLink: z.string().url().optional().or(z.literal("")).nullable(),
  phone: z.string().max(30).optional().default(""),
  headline: z.string().max(120).optional().default(""),
  summary: z.string().max(1000).optional().default(""),
  experienceYears: z.coerce.number().min(0).max(60).optional().default(0),
  skills: z.array(z.string().min(1)).min(1, "Add at least one skill"),
  targetLocations: z.array(z.string().min(1)).min(1, "Add at least one target location"),
  outreachPreferences: z
    .object({
      tone: z.enum(["formal", "friendly", "concise"]).default("friendly"),
      notes: z.string().max(500).optional().default(""),
    })
    .optional()
    .default({ tone: "friendly", notes: "" }),
});

export async function POST(req: Request) {
  const user = await requireUser();
  const body = await req.json();

  const parsed = ProfileInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;

  const profile = await prisma.profile.upsert({
    where: { userId: user.id },
    update: {
      resumeFileUrl: data.resumeFileUrl ?? undefined,
      resumeFileName: data.resumeFileName ?? undefined,
      resumeDriveLink: data.resumeDriveLink || null,
      phone: data.phone || null,
      headline: data.headline,
      summary: data.summary,
      experienceYears: data.experienceYears,
      skills: data.skills,
      targetLocations: data.targetLocations,
      outreachPreferences: data.outreachPreferences,
    },
    create: {
      userId: user.id,
      resumeFileUrl: data.resumeFileUrl ?? null,
      resumeFileName: data.resumeFileName ?? null,
      resumeDriveLink: data.resumeDriveLink || null,
      phone: data.phone || null,
      headline: data.headline,
      summary: data.summary,
      experienceYears: data.experienceYears,
      skills: data.skills,
      targetLocations: data.targetLocations,
      outreachPreferences: data.outreachPreferences,
    },
  });

  return NextResponse.json({ profile });
}

export async function GET() {
  const user = await requireUser();
  const profile = await prisma.profile.findUnique({ where: { userId: user.id } });
  return NextResponse.json({ profile });
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { PLATFORM_OPTIONS } from "@/lib/scrapers/registry";
import { runJobSearch } from "@/lib/scrapers/run-search";
import { visibleListingsWhere } from "@/lib/scrapers/visible-listings";

const VALID_PLATFORM_IDS = new Set(PLATFORM_OPTIONS.map((p) => p.id));

const BodySchema = z.object({
  keywords: z.array(z.string().trim().min(1)).min(1, "Add at least one keyword").max(10),
  locations: z
    .array(z.string().trim().min(1))
    .min(1, "Add at least one location")
    .max(3, "Up to 3 locations at a time"),
  platforms: z
    .array(z.string())
    .min(1, "Select at least one platform")
    .refine((ids) => ids.every((id) => VALID_PLATFORM_IDS.has(id)), "Unknown platform selected"),
});

export async function POST(req: Request) {
  const user = await requireUser();
  const parsed = BodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  }
  const { keywords, locations, platforms } = parsed.data;

  const jobSearch = await prisma.jobSearch.create({
    data: { userId: user.id, keywords, locations, platforms, status: "PENDING" },
  });

  // Detached on purpose — see runJobSearch's doc comment.
  void runJobSearch({ jobSearchId: jobSearch.id, userId: user.id, keywords, locations, platforms });

  return NextResponse.json({ id: jobSearch.id });
}

export async function GET() {
  const user = await requireUser();
  const searches = await prisma.jobSearch.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      keywords: true,
      locations: true,
      platforms: true,
      status: true,
      createdAt: true,
      _count: { select: { listings: { where: visibleListingsWhere() } } },
    },
  });

  return NextResponse.json({ searches });
}

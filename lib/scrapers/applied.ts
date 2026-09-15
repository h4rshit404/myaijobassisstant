import { prisma } from "@/lib/prisma";

/** dedupeHashes (title+company+location) of every listing this user has already sent an
 * outbound email for, across all of their past searches — used to keep a job that's already
 * been applied to from resurfacing in a new search. */
export async function getAppliedDedupeHashes(userId: string): Promise<Set<string>> {
  const applied = await prisma.jobListing.findMany({
    where: {
      jobSearch: { userId },
      outboundEmails: { some: { status: "SENT" } },
    },
    select: { dedupeHash: true },
  });

  return new Set(applied.map((l) => l.dedupeHash));
}

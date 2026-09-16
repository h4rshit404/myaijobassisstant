import { prisma } from "@/lib/prisma";

/** Every dedupeHash (title+company+location) this user already has a listing for, across
 * every past search — regardless of whether they've applied to it, or it's just sitting
 * queued. Used at persist time so the exact same posting never becomes a second row when a
 * later search turns it up again. */
export async function getExistingDedupeHashes(userId: string): Promise<Set<string>> {
  const rows = await prisma.jobListing.findMany({
    where: { jobSearch: { userId } },
    select: { dedupeHash: true },
  });

  return new Set(rows.map((l) => l.dedupeHash));
}

export function contactKey(company: string, email: string): string {
  return `${company.toLowerCase()}|${email.toLowerCase()}`;
}

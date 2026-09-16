import { prisma } from "@/lib/prisma";
import { contactKey } from "@/lib/scrapers/applied";

/** After this run's listings have resolved contact emails, collapses any (company, email)
 * pair that now appears on more than one of the user's listings — across this search and
 * every past one — down to a single row. A generic inbox (careers@company.com) or the same
 * named person often gets resolved for several differently-worded postings from the same
 * company (different title, found via a different platform); without this they'd all sit in
 * the results/queue as apparent duplicates, and "Apply to All" would email the same address
 * more than once.
 *
 * The kept row is whichever one already has a SENT outbound email (so a duplicate turning up
 * later can't undo an application that already went out), or otherwise the earliest-found
 * one. Every other row in the group has its email fields cleared — same outcome as never
 * having found a contact for it, so it simply drops out of the results everywhere. */
export async function dedupeContactsAcrossSearches(jobSearchId: string, userId: string): Promise<void> {
  const thisRunListings = await prisma.jobListing.findMany({
    where: { jobSearchId, contactEmail: { not: null }, company: { not: null } },
  });
  if (!thisRunListings.length) return;

  const uniquePairs = new Map<string, { company: string; email: string }>();
  for (const listing of thisRunListings) {
    const company = listing.company as string;
    const email = listing.contactEmail as string;
    uniquePairs.set(contactKey(company, email), { company, email });
  }

  for (const { company, email } of uniquePairs.values()) {
    const group = await prisma.jobListing.findMany({
      where: {
        jobSearch: { userId },
        company: { equals: company, mode: "insensitive" },
        contactEmail: { equals: email, mode: "insensitive" },
      },
      include: { outboundEmails: { where: { status: "SENT" }, take: 1 } },
      orderBy: { createdAt: "asc" },
    });
    if (group.length <= 1) continue;

    const keeper = group.find((l) => l.outboundEmails.length > 0) ?? group[0];
    const toClear = group.filter((l) => l.id !== keeper.id);
    if (!toClear.length) continue;

    await prisma.jobListing.updateMany({
      where: { id: { in: toClear.map((l) => l.id) } },
      data: { contactEmail: null, emailType: "UNKNOWN", emailSource: null, aiConfidence: null },
    });
  }
}

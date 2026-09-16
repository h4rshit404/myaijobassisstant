import { prisma } from "@/lib/prisma";
import { getScraperKeysForUser } from "@/lib/scrapers/keys";
import { mapWithConcurrency } from "@/lib/scrapers/http";
import { findCompanyContact, type HunterContact } from "@/lib/enrichment/hunter";

const CONCURRENCY = 3;

/** Runs independently of the AI text classifier — Hunter.io looks up real HR/careers and
 * named employees' emails for a company directly, which works even when a posting's own
 * text never mentioned an email at all (the common case). Only touches listings the text
 * classifier didn't already resolve, and only needs a Hunter key, not an OpenAI one. Caches
 * one lookup per unique company name per run since the free tier's quota is small. */
export async function enrichListingsWithHunter(jobSearchId: string, userId: string): Promise<void> {
  const keys = await getScraperKeysForUser(userId);
  if (!keys.hunterApiKey) return;

  const listings = await prisma.jobListing.findMany({
    where: { jobSearchId, contactEmail: null, company: { not: null } },
  });
  if (!listings.length) return;

  const uniqueCompanies = [...new Set(listings.map((l) => l.company as string))];
  const cache = new Map<string, HunterContact | null>();

  await mapWithConcurrency(uniqueCompanies, CONCURRENCY, async (company) => {
    cache.set(company, await findCompanyContact(company, keys.hunterApiKey!));
  });

  await mapWithConcurrency(listings, 4, async (listing) => {
    const contact = cache.get(listing.company as string);
    if (!contact) return;

    await prisma.jobListing.update({
      where: { id: listing.id },
      data: {
        contactEmail: contact.contactEmail,
        contactName: contact.contactName,
        emailType: contact.emailType,
        emailSource: "HUNTER",
        aiConfidence: contact.confidence,
        aiError: null,
      },
    });
  });
}

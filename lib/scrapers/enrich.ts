import { prisma } from "@/lib/prisma";
import { fetchPublic, mapWithConcurrency } from "@/lib/scrapers/http";
import { extractJobPostingsFromJsonLd } from "@/lib/scrapers/json-ld";
import { extractReadableText } from "@/lib/scrapers/extract-readable-text";

const MIN_DESCRIPTION_LENGTH = 300;
const MAX_LISTINGS_TO_ENRICH = 80;
const CONCURRENCY = 5;
const FETCH_TIMEOUT_MS = 8000;

/** Search-result summaries rarely carry a contact email — postings put that in the body of
 * the actual listing (and that's usually the company's own careers page or ATS, since most
 * aggregators just link through to the original source). This follows each listing's
 * sourceUrl and pulls the full page text so classification has real text to search, instead
 * of just a title/company/location card. Best-effort and bounded: a page that blocks the
 * fetch, times out, or has nothing useful just leaves that listing's description as-is. */
export async function enrichListingsWithFullText(jobSearchId: string): Promise<void> {
  const listings = await prisma.jobListing.findMany({
    where: {
      jobSearchId,
      sourceUrl: { not: null },
    },
    take: MAX_LISTINGS_TO_ENRICH,
    orderBy: { createdAt: "asc" },
  });

  const candidates = listings.filter(
    (l) => (l.descriptionRaw?.length ?? 0) < MIN_DESCRIPTION_LENGTH
  );

  await mapWithConcurrency(candidates, CONCURRENCY, async (listing) => {
    if (!listing.sourceUrl) return;

    const res = await fetchPublic(listing.sourceUrl, FETCH_TIMEOUT_MS);
    if (!res.ok) return;
    const html = await res.text();

    const jsonLdJobs = extractJobPostingsFromJsonLd(html, listing.sourcePlatform);
    const jsonLdDescription = jsonLdJobs
      .map((j) => j.descriptionRaw)
      .filter((d): d is string => !!d)
      .sort((a, b) => b.length - a.length)[0];

    const newText = jsonLdDescription ?? extractReadableText(html);
    if (!newText || newText.length <= (listing.descriptionRaw?.length ?? 0)) return;

    await prisma.jobListing.update({
      where: { id: listing.id },
      data: { descriptionRaw: newText },
    });
  });
}

import { prisma } from "@/lib/prisma";
import { runScrapePipeline } from "@/lib/scrapers/pipeline";
import { enrichListingsWithFullText } from "@/lib/scrapers/enrich";
import { classifyJobListings } from "@/lib/ai/classify-listings";
import { enrichListingsWithHunter } from "@/lib/enrichment/enrich-with-hunter";
import { guessListingEmails } from "@/lib/ai/guess-listing-emails";
import { dedupeContactsAcrossSearches } from "@/lib/scrapers/dedupe-contacts";

/** Orchestrates a full search run: scrape (all platforms in parallel, isolated failures,
 * cross-search dedupe of identical postings at insert time) -> enrich (fetch full posting
 * text) -> classify (AI, best-effort) -> enrich via Hunter.io (company-level HR/employee
 * email lookup, for whatever's still unresolved) -> AI-guess (last resort: infer a
 * standard-pattern HR email from the company name alone, for whatever even Hunter couldn't
 * find) -> dedupe resolved contacts across every search (collapse duplicate company+email
 * matches down to one row, preferring an already-applied one) -> DONE. Only reaches FAILED
 * if something outside the per-adapter/per-listing error handling throws (e.g. the database
 * itself is unreachable).
 *
 * Runs detached from the request that kicked it off (see /api/search), relying on the
 * Node.js process staying alive between requests — true for `next dev`/`next start`, but
 * would need a real background job queue on a per-request serverless deployment. */
export async function runJobSearch(params: {
  jobSearchId: string;
  userId: string;
  keywords: string[];
  locations: string[];
  platforms: string[];
}): Promise<void> {
  const { jobSearchId, userId, keywords, locations, platforms } = params;

  try {
    await prisma.jobSearch.update({ where: { id: jobSearchId }, data: { status: "SCRAPING" } });

    const sourceStatus = await runScrapePipeline({ jobSearchId, userId, keywords, locations, platforms });

    await prisma.jobSearch.update({
      where: { id: jobSearchId },
      data: { status: "ENRICHING", sourceStatus: JSON.parse(JSON.stringify(sourceStatus)) },
    });

    // Search-result summaries rarely carry a contact email — fetch each listing's original
    // posting (often the company's own careers page) for the full text before classifying.
    await enrichListingsWithFullText(jobSearchId);

    await prisma.jobSearch.update({ where: { id: jobSearchId }, data: { status: "CLASSIFYING" } });

    await classifyJobListings(jobSearchId, userId);

    // Text classification only finds an email if the posting mentioned one. For everything
    // still unresolved, look up the company directly via Hunter.io — independent of OpenAI.
    await enrichListingsWithHunter(jobSearchId, userId);

    // Last resort: for whatever's still unresolved, ask the AI to infer a standard-pattern
    // HR email from the company name — unverified, so it's marked distinctly (emailSource).
    await guessListingEmails(jobSearchId, userId);

    // A resolved contact might be the exact same (company, email) pair as another listing —
    // this search's own, or a past search's, applied or still queued. Collapse to one row.
    await dedupeContactsAcrossSearches(jobSearchId, userId);

    await prisma.jobSearch.update({ where: { id: jobSearchId }, data: { status: "DONE" } });
  } catch (err) {
    await prisma.jobSearch.update({
      where: { id: jobSearchId },
      data: { status: "FAILED", errorMessage: err instanceof Error ? err.message : "Unknown error" },
    });
  }
}

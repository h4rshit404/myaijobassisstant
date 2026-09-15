import { prisma } from "@/lib/prisma";
import { runScrapePipeline } from "@/lib/scrapers/pipeline";
import { classifyJobListings } from "@/lib/ai/classify-listings";

/** Orchestrates a full search run: scrape (all platforms in parallel, isolated failures) ->
 * classify (AI, best-effort) -> DONE. Only reaches FAILED if something outside the
 * per-adapter/per-listing error handling throws (e.g. the database itself is unreachable).
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
      data: { status: "CLASSIFYING", sourceStatus: JSON.parse(JSON.stringify(sourceStatus)) },
    });

    await classifyJobListings(jobSearchId, userId);

    await prisma.jobSearch.update({ where: { id: jobSearchId }, data: { status: "DONE" } });
  } catch (err) {
    await prisma.jobSearch.update({
      where: { id: jobSearchId },
      data: { status: "FAILED", errorMessage: err instanceof Error ? err.message : "Unknown error" },
    });
  }
}

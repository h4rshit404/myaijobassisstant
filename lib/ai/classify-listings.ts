import { prisma } from "@/lib/prisma";
import { getOpenAIForUser } from "@/lib/openai/client";
import { classifyContactEmail } from "@/lib/openai/classify-email";
import { mapWithConcurrency } from "@/lib/scrapers/http";

/** Classifies every UNKNOWN listing in a search that has description text. A listing that
 * fails classification (bad model response, API error) is left as UNKNOWN with aiError set
 * rather than blocking the rest of the batch — one flaky call never stalls the whole run. */
export async function classifyJobListings(jobSearchId: string, userId: string): Promise<void> {
  const openai = await getOpenAIForUser(userId);
  if (!openai) return; // No key configured — listings simply stay UNKNOWN.

  const listings = await prisma.jobListing.findMany({
    where: { jobSearchId, emailType: "UNKNOWN", descriptionRaw: { not: null } },
  });

  await mapWithConcurrency(listings, 4, async (listing) => {
    if (!listing.descriptionRaw) return;

    const result = await classifyContactEmail(openai, listing.descriptionRaw);
    if (!result) {
      await prisma.jobListing.update({
        where: { id: listing.id },
        data: { aiError: "AI classification failed" },
      });
      return;
    }

    await prisma.jobListing.update({
      where: { id: listing.id },
      data: {
        contactEmail: result.contactEmail,
        emailType: result.emailType,
        aiConfidence: result.confidence,
        aiError: null,
      },
    });
  });
}

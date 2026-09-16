import { prisma } from "@/lib/prisma";
import { getOpenAIForUser } from "@/lib/openai/client";
import { guessCompanyEmail, type GuessedEmail } from "@/lib/openai/guess-email";
import { extractTrustedDomainHint } from "@/lib/enrichment/known-non-company-domains";
import { mapWithConcurrency } from "@/lib/scrapers/http";

// A guess is inherently less trustworthy than a scraped or looked-up email — cap it well
// below what classification/Hunter can report, regardless of how confident the model claims.
const MAX_GUESS_CONFIDENCE = 0.45;

/** Last-resort fallback, run after both text classification and Hunter.io have had a shot:
 * asks the AI to infer a plausible HR email from the company name alone. Caches one guess
 * per unique company per run (same rationale as Hunter — no point asking twice), and only
 * runs when an OpenAI key is configured. A listing that still gets nothing stays excluded
 * from the results, same as before this step existed. */
export async function guessListingEmails(jobSearchId: string, userId: string): Promise<void> {
  const openai = await getOpenAIForUser(userId);
  if (!openai) return;

  const listings = await prisma.jobListing.findMany({
    where: { jobSearchId, contactEmail: null, company: { not: null } },
  });
  if (!listings.length) return;

  const cache = new Map<string, GuessedEmail | null>();

  await mapWithConcurrency(listings, 4, async (listing) => {
    const company = listing.company as string;

    if (!cache.has(company)) {
      const domainHint = extractTrustedDomainHint(listing.sourceUrl);
      cache.set(
        company,
        await guessCompanyEmail(openai, {
          company,
          jobTitle: listing.title,
          sourcePlatform: listing.sourcePlatform,
          domainHint,
        })
      );
    }

    const guess = cache.get(company);
    if (!guess?.contactEmail) return;

    await prisma.jobListing.update({
      where: { id: listing.id },
      data: {
        contactEmail: guess.contactEmail,
        emailType: "HR",
        emailSource: "AI_GUESSED",
        aiConfidence: Math.min(guess.confidence, MAX_GUESS_CONFIDENCE),
        aiError: null,
      },
    });
  });
}

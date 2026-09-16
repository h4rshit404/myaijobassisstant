import { z } from "zod";
import type { UserOpenAI } from "@/lib/openai/client";

export const GuessedEmailSchema = z.object({
  recognizedCompany: z.boolean(),
  companyDomain: z.string().nullable(),
  contactEmail: z.string().email().nullable(),
  confidence: z.number().min(0).max(1),
});
export type GuessedEmail = z.infer<typeof GuessedEmailSchema>;

const SYSTEM_PROMPT = `You infer a plausible official HR/careers contact email for a company, for
cold job-application outreach, when no real email could be found by scraping or a directory
lookup. You must reason ONLY from your own general knowledge of the company and standard
corporate email conventions (e.g. careers@domain, hr@domain, jobs@domain, recruiting@domain) —
you are not given the posting's text.

Be conservative: only produce a guess if you clearly recognize this specific company and are
reasonably confident of its real domain (a well-known or otherwise identifiable organization —
not a generic/ambiguous name, and not a small or unfamiliar company you're guessing about). If
a "domainHint" is provided, it was independently verified to belong to that company's own site
(not a job board) — prefer it over your own guess of the domain if given. If you don't
recognize the company or aren't reasonably sure of its domain, return recognizedCompany: false
and null for the other fields rather than fabricating one.

Respond as JSON: { "recognizedCompany": boolean, "companyDomain": string|null,
"contactEmail": string|null, "confidence": number (0-1) }`;

interface GuessEmailParams {
  company: string;
  jobTitle: string;
  sourcePlatform: string;
  domainHint?: string | null;
}

/** Last-resort fallback when neither the posting's own text nor Hunter.io produced a
 * contact email: asks the AI to infer a standard-pattern HR email from what it already
 * knows about the company. Inherently unverified — callers must mark it as a guess (the
 * emailSource field) rather than presenting it with the same confidence as a real lookup.
 * Never throws; returns null on any failure or when the model declines to guess. */
export async function guessCompanyEmail(
  openai: UserOpenAI,
  params: GuessEmailParams
): Promise<GuessedEmail | null> {
  try {
    const userContent = JSON.stringify({
      company: params.company,
      jobTitle: params.jobTitle,
      sourcePlatform: params.sourcePlatform,
      domainHint: params.domainHint ?? null,
    });

    const completion = await openai.client.chat.completions.create({
      model: openai.model,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userContent },
      ],
      temperature: 0,
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) return null;

    const parsed = GuessedEmailSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) return null;

    const result = parsed.data;
    if (!result.recognizedCompany || !result.contactEmail) return null;

    return result;
  } catch {
    return null;
  }
}

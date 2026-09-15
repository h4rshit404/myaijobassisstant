import { z } from "zod";
import type { UserOpenAI } from "@/lib/openai/client";

export const EmailClassificationSchema = z.object({
  contactEmail: z.string().email().nullable(),
  emailType: z.enum(["HR", "REFERRAL", "UNKNOWN"]),
  confidence: z.number().min(0).max(1),
});

export type EmailClassification = z.infer<typeof EmailClassificationSchema>;

const SYSTEM_PROMPT = `You extract and classify a contact email address from a job posting's text.

Rules:
- If the text contains an email address meant for applying or contact, extract it exactly as written.
- Classify it as "HR" if it looks like a generic recruiting/careers alias — e.g. local-part starting
  with or containing hr, careers, recruiting, recruitment, jobs, talent, hiring — or a shared team inbox.
- Classify it as "REFERRAL" if it looks like an individual working professional's personal work email
  — e.g. firstname.lastname@company.com, or a named person's address, NOT a generic alias.
- If no email address is present in the text, set contactEmail to null and emailType to "UNKNOWN".
- confidence is your 0-1 confidence in the classification.

Respond with a JSON object: { "contactEmail": string|null, "emailType": "HR"|"REFERRAL"|"UNKNOWN", "confidence": number }`;

/** Returns null (never throws) if the model call or parsing fails — callers should leave the
 * listing at its current UNKNOWN state rather than let one bad response break a batch. */
export async function classifyContactEmail(
  openai: UserOpenAI,
  jobDescription: string
): Promise<EmailClassification | null> {
  if (!jobDescription.trim()) return null;

  try {
    const completion = await openai.client.chat.completions.create({
      model: openai.model,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: jobDescription.slice(0, 6000) },
      ],
      temperature: 0,
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) return null;

    const parsed = EmailClassificationSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

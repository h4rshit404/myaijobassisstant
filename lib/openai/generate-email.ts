import { z } from "zod";
import type { UserOpenAI } from "@/lib/openai/client";

export const GeneratedEmailSchema = z.object({
  subject: z.string().min(1).max(200),
  body: z.string().min(1).max(4000),
});
export type GeneratedEmail = z.infer<typeof GeneratedEmailSchema>;

interface GenerateEmailParams {
  type: "APPLICATION" | "REFERRAL";
  jobTitle: string;
  company?: string | null;
  location?: string | null;
  candidateName: string;
  headline?: string;
  skills: string[];
  resumeLink: string;
  tone: string;
  notes?: string;
}

function systemPrompt(type: "APPLICATION" | "REFERRAL"): string {
  if (type === "APPLICATION") {
    return `You write a short, high-interest job application email to an HR/careers inbox.
Reference the specific job title, location, and a couple of the candidate's key skills.
Include the resume link as a clear line (e.g. "Resume: <link>"). Sign off with the candidate's name.
Keep it under 150 words. Respond as JSON: { "subject": string, "body": string }.`;
  }
  return `You write a warm, concise referral-request email to a working professional at the
hiring company, asking for an internal referral or brief advice for a specific role. Reference
the job title and why the candidate is a fit (a couple of key skills). Include the resume link
as a clear line (e.g. "Resume: <link>"). Sign off with the candidate's name. Keep it under 130
words, and make it feel personal, not templated. Respond as JSON: { "subject": string, "body": string }.`;
}

function fallbackEmail(params: GenerateEmailParams): GeneratedEmail {
  const { type, jobTitle, company, candidateName, skills, resumeLink } = params;
  const companyPart = company ? ` at ${company}` : "";
  const skillsPart = skills.slice(0, 3).join(", ");

  if (type === "APPLICATION") {
    return {
      subject: `Application for ${jobTitle}${companyPart}`,
      body: `Hi,

I'm writing to apply for the ${jobTitle} role${companyPart}. My background includes ${skillsPart}, and I believe I'd be a strong fit for this position.

Resume: ${resumeLink}

Thank you for your time and consideration.

Best regards,
${candidateName}`,
    };
  }

  return {
    subject: `Quick question about the ${jobTitle} role${companyPart}`,
    body: `Hi,

I came across the ${jobTitle} opening${companyPart} and wanted to reach out directly. My background includes ${skillsPart}, and I'd really appreciate a referral or any advice you could share about the role.

Resume: ${resumeLink}

Thanks so much for your time!

Best,
${candidateName}`,
  };
}

/** Falls back to a static template (never returns null) if no OpenAI client is configured
 * or the model call/parsing fails — email drafting should never be a hard blocker. */
export async function generateOutreachEmail(
  openai: UserOpenAI | null,
  params: GenerateEmailParams
): Promise<GeneratedEmail> {
  if (!openai) return fallbackEmail(params);

  try {
    const userContent = JSON.stringify({
      jobTitle: params.jobTitle,
      company: params.company,
      location: params.location,
      candidateName: params.candidateName,
      headline: params.headline,
      skills: params.skills,
      resumeLink: params.resumeLink,
      tone: params.tone,
      notes: params.notes,
    });

    const completion = await openai.client.chat.completions.create({
      model: openai.model,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt(params.type) },
        { role: "user", content: userContent },
      ],
      temperature: 0.6,
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) return fallbackEmail(params);

    const parsed = GeneratedEmailSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : fallbackEmail(params);
  } catch {
    return fallbackEmail(params);
  }
}

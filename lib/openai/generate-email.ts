import { z } from "zod";
import type { UserOpenAI } from "@/lib/openai/client";

export const GeneratedEmailSchema = z.object({
  subject: z.string().min(1).max(200),
  body: z.string().min(1).max(6000),
});
export type GeneratedEmail = z.infer<typeof GeneratedEmailSchema>;

interface GenerateEmailParams {
  type: "APPLICATION" | "REFERRAL";
  jobTitle: string;
  company?: string | null;
  location?: string | null;
  jobUrl?: string | null;
  candidateName: string;
  phone?: string | null;
  headline?: string;
  skills: string[];
  resumeLink: string;
  tone: string;
  notes?: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function systemPrompt(type: "APPLICATION" | "REFERRAL"): string {
  const shared = `The body must be HTML (a few short <p> paragraphs), not plain text. Embed the
resume link as clickable anchor text inside a sentence — e.g. <a href="RESUME_LINK">my resume</a>
or <a href="RESUME_LINK">here</a> — never print a raw URL on its own. If a jobUrl is given,
also reference the specific posting with its own clickable anchor text (e.g. "the posting" or
"this role") linking to it, somewhere natural in the email — don't invent one if jobUrl is
null. Sign off with the candidate's name and, on the line under it, their phone number if one
was given. Respond as JSON: { "subject": string, "body": string (HTML) }.`;

  if (type === "APPLICATION") {
    return `You write a short, high-interest job application email to an HR/careers inbox.
Reference the specific job title, location, and a couple of the candidate's key skills.
Keep it under 150 words. ${shared}`;
  }
  return `You write a warm, concise referral-request email to a working professional at the
hiring company, asking for an internal referral or brief advice for a specific role. Reference
the job title and why the candidate is a fit (a couple of key skills). Keep it under 130 words,
and make it feel personal, not templated. ${shared}`;
}

function fallbackEmail(params: GenerateEmailParams): GeneratedEmail {
  const { type, jobTitle, company, jobUrl, candidateName, phone, skills, resumeLink } = params;
  const companyPart = company ? ` at ${escapeHtml(company)}` : "";
  const skillsPart = escapeHtml(skills.slice(0, 3).join(", "));
  const title = escapeHtml(jobTitle);
  const titlePart = jobUrl ? `<a href="${jobUrl}">${title} role</a>` : `${title} role`;
  const name = escapeHtml(candidateName);
  const signature = `<p>${type === "APPLICATION" ? "Best regards" : "Best"},<br>${name}${
    phone ? `<br>${escapeHtml(phone)}` : ""
  }</p>`;

  if (type === "APPLICATION") {
    return {
      subject: `Application for ${jobTitle}${company ? ` at ${company}` : ""}`,
      body: `<p>Hi,</p>
<p>I'm writing to apply for the ${titlePart}${companyPart}. My background includes ${skillsPart}, and I believe I'd be a strong fit for this position.</p>
<p>You can view <a href="${resumeLink}">my resume here</a>.</p>
<p>Thank you for your time and consideration.</p>
${signature}`,
    };
  }

  const openingTitlePart = jobUrl ? `<a href="${jobUrl}">${title} opening</a>` : `${title} opening`;
  return {
    subject: `Quick question about the ${jobTitle} role${company ? ` at ${company}` : ""}`,
    body: `<p>Hi,</p>
<p>I came across the ${openingTitlePart}${companyPart} and wanted to reach out directly. My background includes ${skillsPart}, and I'd really appreciate a referral or any advice you could share about the role.</p>
<p>You can view <a href="${resumeLink}">my resume here</a>.</p>
<p>Thanks so much for your time!</p>
${signature}`,
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
      jobUrl: params.jobUrl ?? null,
      candidateName: params.candidateName,
      phone: params.phone,
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

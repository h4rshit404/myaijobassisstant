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
  contactName?: string | null;
  candidateName: string;
  phone?: string | null;
  linkedinUrl?: string | null;
  githubUrl?: string | null;
  headline?: string;
  summary?: string;
  experienceYears?: number | null;
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
  const shared = `The body must be HTML (a few short <p> paragraphs), not plain text.

Structure it like this:
1. Greeting — "Hi <first name>," if a contactName was given, otherwise just "Hi,".
2. Opening line: mention you saw the opening for the specific job title (embedded as
   clickable anchor text linking to jobUrl if one was given — don't invent a link if it's
   null) at the company, that you wanted to reach out directly, and weave in the candidate's
   years of experience anchored to their PRIMARY skill — the first entry in the skills list —
   e.g. "with X+ years of experience in Java, I build scalable, reliable systems" if their top
   skill is Java, or "...in Python..." if it's Python. Always name the actual top skill given;
   never generalize it away into something vague. If skills is empty, fall back to their
   headline for this phrase instead. Only state an experience figure if experienceYears was
   actually given.
3. A short "what I'd bring to the table" section: one line introducing it, then a
   "Core stack:" line listing the candidate's actual skills in the order given, starting with
   that same primary skill (don't invent skills, don't reorder away from it), and one line
   naming a real strength grounded in their headline/summary (e.g. performance, reliability,
   scalability) — don't fabricate specifics not implied by the given profile.
4. A line saying the resume is available, with the resume link as clickable anchor text (e.g.
   <a href="RESUME_LINK">my resume</a>) — never print a raw URL on its own.
5. A short closing line inviting a quick chat to discuss how the candidate can help.
6. Sign-off: the candidate's name, then — each on its own line, and ONLY the ones actually
   given — phone number as plain text, "LinkedIn" as clickable anchor text linking to
   linkedinUrl, "GitHub" as clickable anchor text linking to githubUrl.

Keep the whole email under 180 words. Respond as JSON: { "subject": string, "body": string (HTML) }.`;

  if (type === "APPLICATION") {
    return `You write a warm but high-interest job application email to an HR/careers inbox, applying for a specific role. ${shared}`;
  }
  return `You write a warm, concise referral-request email to a working professional at the
hiring company, asking for an internal referral or brief advice for a specific role — softer
ask than a direct application, make it feel personal, not templated. ${shared}`;
}

function formatExperience(years: number | null | undefined): string | null {
  if (!years || years < 1) return null;
  return `${Math.floor(years)}+ years`;
}

function signatureBlock(
  type: "APPLICATION" | "REFERRAL",
  candidateName: string,
  phone?: string | null,
  linkedinUrl?: string | null,
  githubUrl?: string | null
): string {
  const lines = [`${type === "APPLICATION" ? "Best regards" : "Best"},`, escapeHtml(candidateName)];
  if (phone) lines.push(escapeHtml(phone));
  if (linkedinUrl) lines.push(`<a href="${linkedinUrl}">LinkedIn</a>`);
  if (githubUrl) lines.push(`<a href="${githubUrl}">GitHub</a>`);
  return `<p>${lines.join("<br>")}</p>`;
}

function fallbackEmail(params: GenerateEmailParams): GeneratedEmail {
  const {
    type,
    jobTitle,
    company,
    jobUrl,
    contactName,
    candidateName,
    phone,
    linkedinUrl,
    githubUrl,
    headline,
    experienceYears,
    skills,
    resumeLink,
  } = params;

  const companyPart = company ? ` at ${escapeHtml(company)}` : "";
  const skillsPart = escapeHtml(skills.slice(0, 5).join(", "));
  const title = escapeHtml(jobTitle);
  const experiencePart = formatExperience(experienceYears);
  const signature = signatureBlock(type, candidateName, phone, linkedinUrl, githubUrl);

  const titlePart = jobUrl ? `<a href="${jobUrl}">${title} opening</a>` : `${title} opening`;

  // The primary (first-listed) skill drives the specialization phrase, so an email for a
  // profile with "Java" as the top skill reads differently from one with "Python" —
  // headline is only a fallback when no skills are set at all.
  const primarySkill = skills[0] ? escapeHtml(skills[0]) : null;
  const domainPhrase = primarySkill ?? (headline ? escapeHtml(headline) : null);

  const experienceClause = experiencePart
    ? domainPhrase
      ? ` With ${experiencePart} of experience in ${domainPhrase}, I build scalable, reliable systems.`
      : ` With ${experiencePart} of experience, I build scalable, reliable systems.`
    : domainPhrase
      ? ` I specialize in ${domainPhrase} and build scalable, reliable systems.`
      : ` I build scalable, reliable systems.`;

  const closingAsk =
    type === "APPLICATION"
      ? "I'd love a quick chat to discuss how I can help."
      : "I'd really appreciate a referral or any advice you could share — happy to do a quick chat if useful.";

  return {
    subject:
      type === "APPLICATION"
        ? `Application for ${jobTitle}${company ? ` at ${company}` : ""}`
        : `Quick question about the ${jobTitle} role${company ? ` at ${company}` : ""}`,
    body: `<p>Hi${contactName ? ` ${escapeHtml(contactName)}` : ""},</p>
<p>I saw your ${titlePart}${companyPart} and wanted to reach out directly.${experienceClause}</p>
<p>A brief snapshot of what I'd bring to the table:</p>
<p><strong>Core stack:</strong> ${skillsPart}<br>Focus on performance and reliability.</p>
<p>You can view <a href="${resumeLink}">my resume here</a>.</p>
<p>${closingAsk}</p>
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
      contactName: params.contactName ?? null,
      candidateName: params.candidateName,
      phone: params.phone ?? null,
      linkedinUrl: params.linkedinUrl ?? null,
      githubUrl: params.githubUrl ?? null,
      headline: params.headline,
      summary: params.summary,
      experienceYears: params.experienceYears ?? null,
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

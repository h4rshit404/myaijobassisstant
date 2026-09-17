import { z } from "zod";
import type OpenAI from "openai";
import type { UserOpenAI } from "@/lib/openai/client";
import { getOpenRouterClient } from "@/lib/openrouter/client";

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
  jobDescription?: string | null;
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
  const roleContext =
    type === "APPLICATION"
      ? "a job application email to the HR/careers inbox for a specific open role"
      : "a referral-request email to a working professional at the hiring company, asking for an internal referral or brief advice — a softer ask than a direct application";

  return `You write ${roleContext}. Sound like a genuinely interested, specific human writing
about THIS role — not a template that could be sent to any company for any job. The single
biggest failure mode to avoid is genericness: an email that never touches anything actually
specific to this posting or this candidate reads as mass-sent and gets ignored.

How to use what you're given:
- jobDescription, if given: read it and pull out 1-2 concrete, specific details — a named
  technology/tool, a stated responsibility, a product/team area, a requirement — and
  reference them naturally in the opening, tied directly to the candidate's matching
  skill(s)/experience. This is what makes the email read as genuinely interested. If
  jobDescription is empty or null, open around the job title, company, and the candidate's
  primary skill instead — never invent role details that weren't given to you.
- skills: the FIRST entry is the candidate's primary skill — anchor the opening's
  specialization phrase on it by name (e.g. "...experience in Java..." vs "...in Python...").
  Never generalize a named technology away into something vague like "backend systems".
- headline/summary: background/context for the candidate, especially useful when
  jobDescription is missing.
- experienceYears: only state a figure if one was actually given.
- location: mention naturally only if it adds real relevance (e.g. same city, or explicitly
  remote) — don't force it in.
- notes (the candidate's own standing instruction for outreach emails, if given): weave it in
  faithfully; it overrides generic phrasing where the two would conflict.
- tone: "formal" → professional and measured, no exclamation points. "friendly" → warm and
  conversational. "concise" → shorter and plainer, under 100 words, minimal pleasantries.
- Never fabricate a skill, employer detail, or job requirement that wasn't given to you.

Structure:
1. Greeting — "Hi <first name>," if contactName was given, otherwise just "Hi,".
2. Opening (2-3 sentences): the specific job title (embedded as clickable anchor text linking
   to jobUrl if one was given), the company, and — the important part — something concrete
   from jobDescription if you have it, connected to the candidate's matching
   skill/experience. Without jobDescription, open around title + company + primary skill +
   experienceYears instead.
3. A short "what I'd bring to the table" section: one intro line, then a "Core stack:" line
   listing the candidate's actual skills in the order given (primary skill first — don't
   invent skills, don't reorder away from it), then one line naming a real, specific strength
   connected to something in jobDescription if you have it (e.g. "particularly relevant given
   the role's focus on <thing actually mentioned>"), otherwise a general strength grounded in
   headline/summary.
4. A line saying the resume is available, with the resume link as clickable anchor text (e.g.
   <a href="RESUME_LINK">my resume</a>) — never print a raw URL on its own.
5. A short closing line inviting a quick chat to discuss how the candidate can help.
6. Sign-off: the candidate's name, then — each on its own line, and ONLY the ones actually
   given — phone number as plain text, "LinkedIn" as clickable anchor text linking to
   linkedinUrl, "GitHub" as clickable anchor text linking to githubUrl.

The body must be HTML (a few short <p> paragraphs), not plain text. Keep the whole email under
180 words (under 100 if tone is "concise"). Respond as JSON: { "subject": string, "body": string (HTML) }.`;
}

function formatExperience(years: number | null | undefined): string | null {
  if (!years || years < 1) return null;
  return `${Math.floor(years)}+ years`;
}

/** Best-effort, non-AI signal for the fallback template: does the actual posting text
 * mention any of the candidate's skills? If so, that's worth calling out specifically
 * instead of only ever listing skills generically. */
function findSkillMentionedInDescription(
  jobDescription: string | null | undefined,
  skills: string[]
): string | null {
  if (!jobDescription) return null;
  const lower = jobDescription.toLowerCase();
  return skills.find((skill) => skill.length > 1 && lower.includes(skill.toLowerCase())) ?? null;
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
    jobDescription,
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

  const matchedSkill = findSkillMentionedInDescription(jobDescription, skills);
  const relevanceLine = matchedSkill
    ? `<p>I noticed the role specifically calls for ${escapeHtml(matchedSkill)}, which is a core part of my background.</p>\n`
    : "";

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
${relevanceLine}<p>A brief snapshot of what I'd bring to the table:</p>
<p><strong>Core stack:</strong> ${skillsPart}<br>Focus on performance and reliability.</p>
<p>You can view <a href="${resumeLink}">my resume here</a>.</p>
<p>${closingAsk}</p>
${signature}`,
  };
}

/** Tries one provider; returns null (never throws) if the call, parsing, or schema
 * validation fails, so the caller can move on to the next provider/fallback. Always logs
 * why, since a silent null here previously made every provider failure indistinguishable
 * from "not configured." */
async function tryProvider(
  label: string,
  client: OpenAI,
  model: string,
  params: GenerateEmailParams
): Promise<GeneratedEmail | null> {
  try {
    const userContent = JSON.stringify({
      jobTitle: params.jobTitle,
      company: params.company,
      location: params.location,
      jobUrl: params.jobUrl ?? null,
      jobDescription: params.jobDescription ?? null,
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

    const completion = await client.chat.completions.create({
      model,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt(params.type) },
        { role: "user", content: userContent },
      ],
      temperature: 0.6,
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) {
      console.error(`[generate-email:${label}] empty response from model "${model}"`);
      return null;
    }

    const parsed = GeneratedEmailSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) {
      console.error(`[generate-email:${label}] response failed schema validation:`, parsed.error.message);
      return null;
    }
    return parsed.data;
  } catch (error) {
    console.error(`[generate-email:${label}] request failed:`, error);
    return null;
  }
}

/** Falls back to a static template (never returns null) if no AI provider is configured or
 * every provider call/parsing fails — email drafting should never be a hard blocker.
 *
 * Provider order: the user's own OpenAI key first, then (if OPENROUTER_API_KEY is set) a
 * free Grok model on OpenRouter as a second attempt, then the static template. */
export async function generateOutreachEmail(
  openai: UserOpenAI | null,
  params: GenerateEmailParams
): Promise<GeneratedEmail> {
  if (openai) {
    const result = await tryProvider("openai", openai.client, openai.model, params);
    if (result) return result;
  }

  const openRouter = getOpenRouterClient();
  if (openRouter) {
    const result = await tryProvider("grok", openRouter.client, openRouter.model, params);
    if (result) return result;
  }

  return fallbackEmail(params);
}

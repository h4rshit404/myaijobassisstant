import { z } from "zod";
import type { UserOpenAI } from "@/lib/openai/client";

export const ResumeExtractionSchema = z.object({
  headline: z.string().max(120).default(""),
  summary: z.string().max(600).default(""),
  experienceYears: z.number().min(0).max(60).default(0),
  skills: z.array(z.string()).max(30).default([]),
  suggestedLocations: z.array(z.string()).max(5).default([]),
});

export type ResumeExtraction = z.infer<typeof ResumeExtractionSchema>;

const SYSTEM_PROMPT = `You are a resume parser. Given raw resume text, extract a concise professional
profile as JSON. Be conservative: only include skills and experience actually stated in the text.
Respond with a JSON object with exactly these fields:
{
  "headline": string,            // e.g. "Senior Backend Engineer"
  "summary": string,             // 2-3 sentence professional summary
  "experienceYears": number,     // total years of professional experience, best estimate
  "skills": string[],            // key technical/professional skills, most relevant first
  "suggestedLocations": string[] // cities/regions implied by the resume (current or past work locations), up to 5
}`;

/** Returns null if the model call fails or the resume text can't be parsed into structured JSON. */
export async function parseResumeWithAI(
  openai: UserOpenAI,
  resumeText: string
): Promise<ResumeExtraction | null> {
  try {
    const completion = await openai.client.chat.completions.create({
      model: openai.model,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: resumeText.slice(0, 15000) },
      ],
      temperature: 0.2,
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) return null;

    const parsed = ResumeExtractionSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
